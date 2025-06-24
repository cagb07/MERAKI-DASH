"use client"

import { useState, useEffect, useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { AlertTriangle, CheckCircle, Info, RefreshCw, Download, Trash2, Wifi, Shield, Activity } from "lucide-react"
import { toast } from "@/hooks/use-toast"
import { ThemeToggle } from "@/components/theme-toggle"
import { validateApiKey, getNetworks, getAlerts, generateTestAlerts, getAllHistoryAlerts } from "@/lib/meraki-api"

interface Alert {
  id: string
  type: string
  severity: "critical" | "warning" | "info"
  message: string
  timestamp: string
  networkId: string
  networkName: string
  deviceSerial: string
  status: "active" | "acknowledged" | "resolved"
}

interface Organization {
  id: string
  name: string
}

interface Network {
  id: string
  name: string
  organizationId: string
}

export default function MerakiDashboard() {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [networks, setNetworks] = useState<Network[]>([])
  const [isConnected, setIsConnected] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [selectedOrg, setSelectedOrg] = useState<string>("all")
  const [selectedNetwork, setSelectedNetwork] = useState<string>("all")
  const [selectedSeverity, setSelectedSeverity] = useState<string>("all")
  const [inputValue, setInputValue] = useState<string>("") // For immediate input
  const [searchTerm, setSearchTerm] = useState("")      // For debounced search
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null)
  const [selectedTimespan, setSelectedTimespan] = useState<number>(86400) // 24 horas por defecto
  // const [loadFullHistory, setLoadFullHistory] = useState(false); // This state is no longer needed / will be removed
  const [useTestData, setUseTestData] = useState(false)

  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [loadedTimespan, setLoadedTimespan] = useState<number>(86400) // Tiempo ya cargado
  const [showLoadMoreWarning, setShowLoadMoreWarning] = useState(false)

  const [apiKey, setApiKey] = useState<string>("")
  const [showApiKeyDialog, setShowApiKeyDialog] = useState(false)
  const [tempApiKey, setTempApiKey] = useState<string>("")

  const [autoRefresh, setAutoRefresh] = useState(false)
  const [refreshInterval, setRefreshInterval] = useState<NodeJS.Timeout | null>(null)
  const [lastAlertCount, setLastAlertCount] = useState(0)

  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(10)

  const [fetchStatusMessages, setFetchStatusMessages] = useState<string[]>([])
  const FULL_HISTORY_TIMESPAN = -1; // Special value to signify full history is loaded

  const connectToMeraki = async () => {
    setFetchStatusMessages([])
    let currentMessages: string[] = []

    if (!apiKey) {
      setShowApiKeyDialog(true)
      return
    }

    setIsLoading(true)
    console.log("🚀 Iniciando conexión a Meraki...")

    try {
      // Limpiar estado anterior
      setAlerts([])
      setOrganizations([])
      setNetworks([])
      setUseTestData(false)
      setLoadedTimespan(86400) // Reset a 24 horas

      // Validar API Key y obtener organizaciones
      console.log("🔑 Validando API Key...")
      const validation = await validateApiKey(apiKey)

      if (!validation.success) {
        throw new Error(validation.error)
      }

      const organizations = validation.organizations
      console.log(`🏢 Organizaciones encontradas: ${organizations.length}`)
      setOrganizations(organizations.map((org) => ({ id: org.id, name: org.name })))

      // Obtener redes de todas las organizaciones en paralelo
      console.log("🌐 Obteniendo redes en paralelo...")
      const collectedNetworks: Network[] = []
      const networkPromises = organizations.map((org) => getNetworks(apiKey, org.id))
      const networkResults = await Promise.allSettled(networkPromises)

      networkResults.forEach((result, index) => {
        const org = organizations[index]
        if (result.status === "fulfilled" && result.value.success) {
          const orgNetworks = result.value.data.map((net: any) => ({
            id: net.id,
            name: net.name,
            organizationId: net.organizationId,
          }))
          collectedNetworks.push(...orgNetworks)
          console.log(`📡 Redes en ${org.name}: ${orgNetworks.length}`)
        } else {
          const errorReason = result.status === "rejected" ? result.reason : result.value.error;
          const errorMessage = errorReason instanceof Error ? errorReason.message : String(errorReason);
          console.error(`❌ Error obteniendo redes de ${org.name}:`, errorMessage)
          currentMessages.push(`Error cargando redes para organización ${org.name}: ${errorMessage}`)
        }
      })
      console.log(`📡 Total redes obtenidas: ${collectedNetworks.length}`)
      setNetworks(collectedNetworks)

      // Generar alertas de prueba inmediatamente para mostrar algo
      console.log("🧪 Generando alertas de prueba para mostrar datos inmediatamente...")
      const testAlerts = await generateTestAlerts(
        organizations[0]?.id || "demo_org",
        collectedNetworks.map((n) => n.id),
      )
      const initialAlerts = testAlerts.map((alert) => ({
        id: alert.id,
        type: alert.type,
        severity: alert.severity,
        message: alert.message,
        timestamp: alert.timestamp,
        networkId: alert.networkId,
        networkName: alert.networkName,
        deviceSerial: alert.deviceSerial,
        status: alert.status,
      }))

      // Actualizar estado inmediatamente con datos de prueba
      setAlerts(initialAlerts)
      setUseTestData(true)
      setIsConnected(true)

      // IMPORTANTE: Resetear loading aquí para mostrar los datos de prueba
      setIsLoading(false)

      console.log(`✅ Mostrando ${initialAlerts.length} alertas de prueba iniciales`)

      toast({
        title: "Conexión exitosa",
        description: `Conectado a Meraki API. Mostrando ${initialAlerts.length} alertas de prueba mientras se cargan datos reales...`,
      })

      // Ahora intentar obtener alertas reales en segundo plano
      console.log("🚨 Intentando obtener alertas reales en segundo plano...")
      const collectedRealAlerts: Alert[] = []
      let hasRealAlerts = false

      const alertPromises = organizations.map((org) => getAlerts(apiKey, org.id, 86400)) // Solo 24 horas inicialmente
      const alertResults = await Promise.allSettled(alertPromises)

      alertResults.forEach((result, index) => {
        const org = organizations[index]
        if (result.status === "fulfilled" && result.value.success) {
          const alertsResult = result.value
          console.log(`📊 Resultado de alertas para ${org.name}:`, alertsResult)
          if (alertsResult.data.length > 0) {
            hasRealAlerts = true
            const orgAlerts = alertsResult.data.map((alert: any) => ({
              id: alert.id,
              type: alert.type,
              severity: alert.severity,
              message: alert.message,
              timestamp: alert.timestamp,
              networkId: alert.networkId,
              networkName: alert.networkName,
              deviceSerial: alert.deviceSerial || "N/A",
              status: alert.status,
            }))
            collectedRealAlerts.push(...orgAlerts)
            console.log(`✅ Alertas reales agregadas de ${org.name}: ${orgAlerts.length}`)
          } else {
            console.log(`ℹ️ Sin alertas reales en ${org.name} o endpoint falló parcialmente.`)
          }
          if (alertsResult.fallback) {
            const message = `Información parcial para organización ${org.name}: Se usó un método alternativo (Error original: ${alertsResult.initialError || "No especificado"})`;
            console.warn(`⚠️ Fallback activado para ${org.name}. Error inicial: ${alertsResult.initialError}`);
            currentMessages.push(message);
          }
          if (alertsResult.partialErrors && alertsResult.partialErrors.length > 0) {
            const partialErrorSummary = alertsResult.partialErrors.map((pe: any) => `${pe.networkName || pe.networkId} (${pe.error})`).join(", ");
            const message = `Algunas redes en organización ${org.name} tuvieron problemas: ${partialErrorSummary}`;
            console.warn(`⚠️ Errores parciales obteniendo alertas de redes en ${org.name}:`, alertsResult.partialErrors);
            currentMessages.push(message);
          }
        } else {
          const errorReason = result.status === "rejected" ? result.reason : (result.value as any)?.error;
          const errorMessage = errorReason instanceof Error ? errorReason.message : String(errorReason);
          console.error(`❌ Error obteniendo alertas de ${org.name}:`, errorMessage);
          currentMessages.push(`Error cargando alertas para organización ${org.name}: ${errorMessage}`);
        }
      })

      // Si encontramos alertas reales, reemplazar las de prueba
      if (hasRealAlerts && collectedRealAlerts.length > 0) {
        console.log(`🎯 Reemplazando con ${collectedRealAlerts.length} alertas reales`)
        setAlerts(collectedRealAlerts)
        setUseTestData(false)

        toast({
          title: "Alertas reales cargadas",
          description: `Se encontraron ${collectedRealAlerts.length} alertas reales de las últimas 24 horas.`,
        })
      } else {
        console.log(`🧪 Manteniendo ${initialAlerts.length} alertas de prueba, no se encontraron alertas reales o hubo errores.`)
      }
      setFetchStatusMessages(currentMessages);
    } catch (error) { // This outer catch handles errors like API key validation failure
      console.error("❌ Error en conexión (validación API Key o error crítico):", error)
      const criticalErrorMsg = error instanceof Error ? error.message : "Error desconocido durante la conexión inicial.";
      currentMessages.push(`Error crítico durante la conexión: ${criticalErrorMsg}`);
      setFetchStatusMessages(currentMessages);
      setIsLoading(false); // Ensure loading is stopped

      // En caso de error, al menos mostrar datos de prueba
      console.log("🧪 Generando alertas de prueba debido a error crítico...")
      const fallbackAlerts = await generateTestAlerts("error_org", collectedNetworks.map(n => n.id).length > 0 ? collectedNetworks.map(n => n.id) : ["error_network"]);
      const errorAlerts = fallbackAlerts.map((alert) => ({
        id: alert.id,
        type: alert.type,
        severity: alert.severity,
        message: `[ERROR] ${alert.message}`,
        timestamp: alert.timestamp,
        networkId: alert.networkId,
        networkName: alert.networkName,
        deviceSerial: alert.deviceSerial,
        status: alert.status,
      }))

      setAlerts(errorAlerts)
      setUseTestData(true)
      setIsConnected(true)

      // IMPORTANTE: También resetear loading en caso de error
      setIsLoading(false)

      toast({
        title: "Error de conexión",
        description: `${error instanceof Error ? error.message : "Error desconocido"}. Mostrando datos de prueba.`,
        variant: "destructive",
      })
    }

    console.log("🏁 Proceso de conexión finalizado")
  }

  const loadMoreAlerts = async () => {
    setFetchStatusMessages([]);
    let currentMessages: string[] = [];
    if (!isConnected || !apiKey || isLoadingMore) return

    // Mostrar advertencia antes de cargar más datos
    const nextTimespan = getNextTimespan(loadedTimespan)
    const timespanText = getTimespanText(nextTimespan)
    const estimatedTime = getEstimatedLoadTime(nextTimespan)

    const confirmed = window.confirm(
      `¿Deseas cargar alertas de ${timespanText}?\n\n` +
        `⚠️ ADVERTENCIA: Esto puede tomar ${estimatedTime} debido a la mayor cantidad de datos.\n\n` +
        `Tiempo de carga estimado: ${estimatedTime}\n` +
        `Datos adicionales: ~${Math.round((nextTimespan - loadedTimespan) / 86400)} días más`,
    )

    if (!confirmed) return

    setIsLoadingMore(true)
    try {
      console.log(`🔄 Cargando más alertas hasta ${timespanText} en paralelo...`)

      const collectedMoreAlerts: Alert[] = []
      let hasNewRealAlerts = false // To track if any new real alerts were fetched in this batch

      const alertPromises = organizations.map((org) => getAlerts(apiKey, org.id, nextTimespan))
      const alertResults = await Promise.allSettled(alertPromises)

      alertResults.forEach((result, index) => {
        const org = organizations[index]
        if (result.status === "fulfilled" && result.value.success) {
          const alertsResult = result.value
          console.log(`📊 Resultado de carga de más alertas para ${org.name}:`, alertsResult)
          if (alertsResult.data.length > 0) {
            hasNewRealAlerts = true
            const orgAlerts = alertsResult.data.map((alert: any) => ({
              id: alert.id,
              type: alert.type,
              severity: alert.severity,
              message: alert.message,
              timestamp: alert.timestamp,
              networkId: alert.networkId,
              networkName: alert.networkName,
              deviceSerial: alert.deviceSerial || "N/A",
              status: alert.status,
            }))
            collectedMoreAlerts.push(...orgAlerts)
            console.log(`✅ Más alertas reales agregadas de ${org.name}: ${orgAlerts.length}`)
          } else {
            console.log(`ℹ️ Sin más alertas reales en ${org.name} para este timespan o endpoint falló parcialmente.`)
          }
          if (alertsResult.fallback) {
            const message = `Información parcial para ${org.name} (más alertas): Método alternativo usado (Error original: ${alertsResult.initialError || "No especificado"})`;
            console.warn(`⚠️ Fallback activado para ${org.name} durante carga de más alertas. Error inicial: ${alertsResult.initialError}`);
            currentMessages.push(message);
          }
          if (alertsResult.partialErrors && alertsResult.partialErrors.length > 0) {
            const partialErrorSummary = alertsResult.partialErrors.map((pe: any) => `${pe.networkName || pe.networkId} (${pe.error})`).join(", ");
            const message = `Algunas redes en ${org.name} tuvieron problemas al cargar más alertas: ${partialErrorSummary}`;
            console.warn(`⚠️ Errores parciales obteniendo más alertas de redes en ${org.name}:`, alertsResult.partialErrors);
            currentMessages.push(message);
          }
        } else {
          const errorReason = result.status === "rejected" ? result.reason : (result.value as any)?.error;
          const errorMessage = errorReason instanceof Error ? errorReason.message : String(errorReason);
          console.error(`❌ Error cargando más alertas de ${org.name}:`, errorMessage);
          currentMessages.push(`Error cargando más alertas para organización ${org.name}: ${errorMessage}`);
        }
      })

      // Si no hay nuevas alertas reales y estábamos usando datos de prueba, podríamos generar más,
      // pero para "loadMore" es más probable que queramos solo lo real.
      // Si se decide generar más datos de prueba aquí, se debe tener cuidado con duplicados.
      // Por ahora, nos enfocamos en agregar las alertas reales o mantener las existentes.

      let finalAlertsToSet: Alert[];
      if (collectedMoreAlerts.length > 0) {
        // Combinar con alertas existentes y luego filtrar duplicados
        const combinedAlerts = [...alerts, ...collectedMoreAlerts];
        finalAlertsToSet = combinedAlerts.filter((alert, index, self) => index === self.findIndex((a) => a.id === alert.id));
        console.log(` combinado ${alerts.length} existentes con ${collectedMoreAlerts.length} nuevas. Total después de duplicados: ${finalAlertsToSet.length}`)
        setUseTestData(false); // Si cargamos más alertas reales, ya no estamos solo con datos de prueba
      } else if (useTestData) {
        // Si no se cargaron nuevas alertas reales y estábamos en modo de prueba, mantenemos las de prueba.
        // Opcionalmente, generar más datos de prueba aquí si es la lógica deseada.
        finalAlertsToSet = [...alerts]; // Mantener las actuales de prueba
        console.log("No se cargaron nuevas alertas reales, se mantienen las de prueba existentes.");
      } else {
        // No hay nuevas alertas reales y no estábamos en modo de prueba, simplemente no hay nada nuevo que agregar.
        finalAlertsToSet = [...alerts]; // Mantener las actuales
        console.log("No se cargaron nuevas alertas reales.");
      }

      setAlerts(finalAlertsToSet)
      setLoadedTimespan(nextTimespan)

      toast({
        title: "Más alertas cargadas",
        description: `Se han procesado alertas de ${timespanText}. Total actual: ${finalAlertsToSet.length} alertas.${(useTestData && !hasNewRealAlerts) ? " (datos de prueba)" : ""}`,
      })
      setFetchStatusMessages(currentMessages);
    } catch (error) { // Catch para errores críticos en Promise.allSettled o configuración
      console.error("❌ Error crítico en loadMoreAlerts:", error)
      const criticalErrorMsg = error instanceof Error ? error.message : "Error desconocido al cargar más alertas.";
      currentMessages.push(`Error crítico al cargar más alertas: ${criticalErrorMsg}`);
      setFetchStatusMessages(currentMessages);
      toast({
        title: "Error Crítico",
        description: "No se pudieron cargar más alertas desde Meraki API",
        variant: "destructive",
      })
    } finally {
      setIsLoadingMore(false)
    }
  }

  const getNextTimespan = (currentTimespan: number): number => {
    if (currentTimespan === 86400) return 259200 // 24h -> 3 días
    if (currentTimespan === 259200) return 604800 // 3 días -> 1 semana
    if (currentTimespan === 604800) return 2592000 // 1 semana -> 1 mes
    if (currentTimespan === 2592000) return 7776000 // 1 mes -> 3 meses
    return 7776000 // Máximo 3 meses
  }

  const getTimespanText = (timespan: number): string => {
    if (timespan === 86400) return "últimas 24 horas"
    if (timespan === 259200) return "últimos 3 días"
    if (timespan === 604800) return "última semana"
    if (timespan === 2592000) return "último mes"
    if (timespan === 7776000) return "últimos 3 meses"
    return "período extendido"
  }

  const getEstimatedLoadTime = (timespan: number): string => {
    if (timespan === 259200) return "10-15 segundos"
    if (timespan === 604800) return "20-30 segundos"
    if (timespan === 2592000) return "45-60 segundos"
    if (timespan === 7776000) return "1-2 minutos"
    return "varios minutos"
  }

  const canLoadMore = (): boolean => {
    return loadedTimespan !== FULL_HISTORY_TIMESPAN && loadedTimespan < 7776000 && !useTestData
  }

  const fetchAllHistoryData = async () => {
    if (!isConnected || !apiKey) return;
    if (isLoading || isLoadingMore) return; // Prevent if another major load is in progress

    setIsLoading(true);
    const initialMessages = ["Iniciando carga de historial completo. Esto puede tardar varios minutos..."];
    setFetchStatusMessages(initialMessages);
    toast({ title: "Cargando Historial Completo", description: "Por favor espera, obteniendo todos los datos históricos disponibles..." });

    let currentMessages: string[] = [...initialMessages];

    try {
      const allHistoricalAlerts: Alert[] = [];

      const orgsToFetch = selectedOrg === 'all' ? organizations : organizations.filter(o => o.id === selectedOrg);

      if (orgsToFetch.length === 0 && selectedOrg !== 'all') {
           currentMessages.push(`Organización seleccionada con ID '${selectedOrg}' no encontrada para cargar historial.`);
           setFetchStatusMessages(currentMessages);
           setIsLoading(false);
           toast({ title: "Error", description: "Organización seleccionada no encontrada.", variant: "destructive"});
           return;
      }
       if (orgsToFetch.length === 0 && organizations.length > 0 && selectedOrg === 'all') {
        currentMessages.push("No hay organizaciones disponibles para cargar el historial (estado inesperado).");
        setFetchStatusMessages(currentMessages);
        setIsLoading(false);
        toast({ title: "Error", description: "No se encontraron organizaciones para procesar.", variant: "destructive"});
        return;
      }
      if (orgsToFetch.length === 0 && selectedOrg === 'all' && organizations.length === 0) {
        currentMessages.push("No hay organizaciones configuradas. Conéctese primero.");
         setFetchStatusMessages(currentMessages);
        setIsLoading(false);
        toast({ title: "Información", description: "No hay organizaciones para obtener historial.", variant: "default"});
        return;
      }

      const historyPromises = orgsToFetch.map(org => getAllHistoryAlerts(apiKey, org.id));
      const historyResults = await Promise.allSettled(historyPromises);

      historyResults.forEach((result: any, index: number) => {
        const org = orgsToFetch[index];
        if (result.status === 'fulfilled' && result.value.success) {
          const mappedAlerts = result.value.data.map((alert: any) => ({
            id: alert.id,
            type: alert.type,
            severity: alert.severity,
            message: alert.message,
            timestamp: alert.timestamp,
            networkId: alert.networkId,
            networkName: alert.networkName,
            deviceSerial: alert.deviceSerial || "N/A",
            status: alert.status,
          }));
          allHistoricalAlerts.push(...mappedAlerts);
          currentMessages.push(`Historial completo cargado para ${org.name} (${mappedAlerts.length} alertas).`);

          if (result.value.fetchErrors && result.value.fetchErrors.length > 0) {
            const errorSummary = result.value.fetchErrors.map((fe: any) => `Chunk ${fe.chunk} (t0: ${fe.t0}, t1: ${fe.t1}): ${fe.message || fe.error || 'Error desconocido en chunk'}`).join('; ');
            currentMessages.push(`Errores parciales en historial de ${org.name}: ${errorSummary}`);
          }
        } else {
          const errorReason = result.status === 'rejected' ? result.reason : (result.value as any)?.error;
          const errorMessage = errorReason instanceof Error ? errorReason.message : String(errorReason);
          currentMessages.push(`Error cargando historial completo para ${org.name}: ${errorMessage}`);
          console.error(`Error cargando historial completo para ${org.name}:`, errorReason);
        }
      });

      allHistoricalAlerts.sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setAlerts(allHistoricalAlerts);
      setUseTestData(false);
      setLoadedTimespan(FULL_HISTORY_TIMESPAN);
      currentMessages.push("Carga de historial completo finalizada.");
      setFetchStatusMessages(currentMessages);
      toast({ title: "Historial Completo Cargado", description: `Se cargaron ${allHistoricalAlerts.length} alertas históricas.` });

    } catch (error) {
      console.error("Error crítico durante fetchAllHistoryData:", error);
      const criticalErrorMsg = error instanceof Error ? error.message : "Desconocido";
      currentMessages.push(`Error crítico al cargar historial completo: ${criticalErrorMsg}`);
      setFetchStatusMessages(currentMessages);
      toast({ title: "Error Crítico", description: "No se pudo cargar el historial completo.", variant: "destructive" });
    } finally {
      setIsLoading(false); // Reset loading state
    }
  };

  const disconnectFromMeraki = () => {
    setIsConnected(false)
    setApiKey("")
    setAlerts([])
    setOrganizations([])
    setNetworks([])
    setSelectedOrg("all")
    setSelectedNetwork("all")
    setSelectedSeverity("all")
    setSearchTerm("")
    setUseTestData(false)
    setLoadedTimespan(86400)
    stopAutoRefresh()
    setLastAlertCount(0)
    toast({
      title: "Desconectado",
      description: "Se ha desconectado de Meraki Dashboard y limpiado todos los datos",
    })
  }

  const changeApiKey = () => {
    setTempApiKey(apiKey)
    setShowApiKeyDialog(true)
  }

  const refreshAlerts = async () => {
    setFetchStatusMessages([]);
    let currentMessages: string[] = [];
    if (!isConnected || !apiKey) return

    setIsLoading(true)
    try {
      console.log(`🔄 Refrescando alertas para el timespan ${getTimespanText(loadedTimespan)} en paralelo...`)
      const refreshedAlerts: Alert[] = []
      let hasRefreshedRealAlerts = false

      const alertPromises = organizations.map((org) => getAlerts(apiKey, org.id, loadedTimespan))
      const alertResults = await Promise.allSettled(alertPromises)

      alertResults.forEach((result, index) => {
        const org = organizations[index]
        if (result.status === "fulfilled" && result.value.success) {
          const alertsResult = result.value
          console.log(`📊 Resultado de refresco de alertas para ${org.name}:`, alertsResult)
          if (alertsResult.data.length > 0) {
            hasRefreshedRealAlerts = true
            const orgAlerts = alertsResult.data.map((alert: any) => ({
              id: alert.id,
              type: alert.type,
              severity: alert.severity,
              message: alert.message,
              timestamp: alert.timestamp,
              networkId: alert.networkId,
              networkName: alert.networkName,
              deviceSerial: alert.deviceSerial || "N/A",
              status: alert.status,
            }))
            refreshedAlerts.push(...orgAlerts)
            console.log(`✅ Alertas refrescadas agregadas de ${org.name}: ${orgAlerts.length}`)
          } else {
            console.log(`ℹ️ Sin alertas (o nuevas alertas) en ${org.name} durante el refresco.`)
          }
          if (alertsResult.fallback) {
            const message = `Información parcial para ${org.name} (refresco): Método alternativo usado (Error original: ${alertsResult.initialError || "No especificado"})`;
            console.warn(`⚠️ Fallback activado para ${org.name} durante refresco. Error inicial: ${alertsResult.initialError}`);
            currentMessages.push(message);
          }
          if (alertsResult.partialErrors && alertsResult.partialErrors.length > 0) {
            const partialErrorSummary = alertsResult.partialErrors.map((pe: any) => `${pe.networkName || pe.networkId} (${pe.error})`).join(", ");
            const message = `Algunas redes en ${org.name} tuvieron problemas durante el refresco: ${partialErrorSummary}`;
            console.warn(`⚠️ Errores parciales obteniendo alertas refrescadas de redes en ${org.name}:`, alertsResult.partialErrors);
            currentMessages.push(message);
          }
        } else {
          const errorReason = result.status === "rejected" ? result.reason : (result.value as any)?.error;
          const errorMessage = errorReason instanceof Error ? errorReason.message : String(errorReason);
          console.error(`❌ Error refrescando alertas de ${org.name}:`, errorMessage);
          currentMessages.push(`Error refrescando alertas para organización ${org.name}: ${errorMessage}`);
        }
      })

      if (hasRefreshedRealAlerts && refreshedAlerts.length > 0) {
        setAlerts(refreshedAlerts) // Sobrescribir con las alertas más recientes
        setUseTestData(false)
        toast({
          title: "Alertas actualizadas",
          description: `Se han cargado ${refreshedAlerts.length} alertas desde Meraki API.`,
        })
      } else if (!hasRefreshedRealAlerts && organizations.length > 0) { // Solo generar test data si no hay orgs o si no hay data real
        console.log("🧪 No se encontraron alertas reales durante el refresco. Generando/manteniendo datos de prueba.")
        const networkIds = networks.map((n) => n.id)
        const testAlerts = await generateTestAlerts(organizations[0]?.id || "test_org_refresh", networkIds.length > 0 ? networkIds : ["test_net_refresh"])
        setAlerts(testAlerts.map((alert: any) => ({
            id: alert.id, type: alert.type, severity: alert.severity, message: alert.message,
            timestamp: alert.timestamp, networkId: alert.networkId, networkName: alert.networkName,
            deviceSerial: alert.deviceSerial, status: alert.status,
        })))
        setUseTestData(true)
        toast({
          title: "Datos de prueba actualizados",
          description: `No se encontraron alertas reales. Mostrando ${testAlerts.length} alertas de prueba.`,
        })
      } else {
         // No organizations or no alerts and no errors, keep current state or clear if appropriate
        console.log("No hay organizaciones para refrescar o no se retornaron alertas.")
        if (organizations.length === 0) { // If no orgs, likely disconnected state, clear alerts
            setAlerts([]);
            setUseTestData(false);
        }
        toast({
          title: "Sin Alertas Nuevas",
          description: "No se encontraron nuevas alertas durante la actualización.",
        });
      }
      setFetchStatusMessages(currentMessages);
    } catch (error) { // Catch para errores críticos
      console.error("❌ Error crítico en refreshAlerts:", error)
      const criticalErrorMsg = error instanceof Error ? error.message : "Error desconocido durante el refresco.";
      currentMessages.push(`Error crítico durante el refresco: ${criticalErrorMsg}`);
      setFetchStatusMessages(currentMessages);
      toast({
        title: "Error Crítico",
        description: "No se pudieron actualizar las alertas desde Meraki API",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const exportAlerts = () => {
    try {
      // Preparar los datos para Excel
      const excelData = filteredAlerts.map((alert, index) => ({
        "No.": index + 1,
        "ID Alerta": alert.id,
        Severidad: alert.severity.toUpperCase(),
        Tipo: alert.type.replace("_", " ").replace(/\b\w/g, (l) => l.toUpperCase()),
        Mensaje: alert.message,
        Red: alert.networkName,
        "ID Red": alert.networkId,
        Dispositivo: alert.deviceSerial,
        Estado: alert.status.toUpperCase(),
        Fecha: new Date(alert.timestamp).toLocaleDateString(),
        Hora: new Date(alert.timestamp).toLocaleTimeString(),
        Timestamp: alert.timestamp,
      }))

      // Crear el contenido CSV (compatible con Excel)
      const headers = Object.keys(excelData[0] || {})
      const csvContent = [
        headers.join(","),
        ...excelData.map((row) =>
          headers
            .map((header) => {
              const value = row[header as keyof typeof row]
              // Escapar comillas y envolver en comillas si contiene comas
              return typeof value === "string" && (value.includes(",") || value.includes('"'))
                ? `"${value.replace(/"/g, '""')}"`
                : value
            })
            .join(","),
        ),
      ].join("\n")

      // Crear el archivo con BOM para compatibilidad con Excel
      const BOM = "\uFEFF"
      const blob = new Blob([BOM + csvContent], {
        type: "text/csv;charset=utf-8",
      })

      // Generar nombre de archivo con fecha y hora
      const now = new Date()
      const dateStr = now.toISOString().split("T")[0]
      const timeStr = now.toTimeString().split(" ")[0].replace(/:/g, "-")
      const filename = `meraki_alertas_${dateStr}_${timeStr}.csv`

      // Descargar el archivo
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = filename
      link.style.display = "none"
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)

      toast({
        title: "Exportación exitosa",
        description: `Alertas exportadas a ${filename}. El archivo se abrirá automáticamente en Excel.`,
      })
    } catch (error) {
      toast({
        title: "Error en exportación",
        description: "No se pudo exportar el archivo. Inténtalo de nuevo.",
        variant: "destructive",
      })
    }
  }

  const clearAlerts = () => {
    setAlerts([])
    setUseTestData(false)
    toast({
      title: "Alertas limpiadas",
      description: "Todas las alertas han sido eliminadas",
    })
  }

  const handleApiKeySubmit = async () => {
    if (tempApiKey.length < 40) {
      toast({
        title: "Error",
        description: "API Key de Meraki debe tener exactamente 40 caracteres",
        variant: "destructive",
      })
      return
    }

    // Validar formato de API Key de Meraki (40 caracteres hexadecimales)
    const merakiKeyPattern = /^[a-fA-F0-9]{40}$/
    if (!merakiKeyPattern.test(tempApiKey)) {
      toast({
        title: "Error",
        description: "Formato de API Key inválido. Debe ser 40 caracteres hexadecimales",
        variant: "destructive",
      })
      return
    }

    setApiKey(tempApiKey)
    setShowApiKeyDialog(false)
    setTempApiKey("")

    toast({
      title: "API Key actualizada",
      description: "Tu API Key de Meraki ha sido actualizada correctamente",
    })
  }

  const playAlertSound = () => {
    try {
      // Crear un sonido usando Web Audio API
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
      const oscillator = audioContext.createOscillator()
      const gainNode = audioContext.createGain()

      oscillator.connect(gainNode)
      gainNode.connect(audioContext.destination)

      oscillator.frequency.setValueAtTime(800, audioContext.currentTime)
      oscillator.frequency.setValueAtTime(600, audioContext.currentTime + 0.1)
      oscillator.frequency.setValueAtTime(800, audioContext.currentTime + 0.2)

      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime)
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3)

      oscillator.start(audioContext.currentTime)
      oscillator.stop(audioContext.currentTime + 0.3)
    } catch (error) {
      console.log("No se pudo reproducir sonido de alerta:", error)
    }
  }

  const startAutoRefresh = () => {
    if (refreshInterval) {
      clearInterval(refreshInterval)
    }

    const interval = setInterval(() => {
      if (isConnected && !isLoading) {
        refreshAlerts()
      }
    }, 10000) // Actualizar cada 10 segundos

    setRefreshInterval(interval)
    setAutoRefresh(true)
  }

  const stopAutoRefresh = () => {
    if (refreshInterval) {
      clearInterval(refreshInterval)
      setRefreshInterval(null)
    }
    setAutoRefresh(false)
  }

  useEffect(() => {
    if (alerts.length > lastAlertCount && lastAlertCount > 0) {
      playAlertSound()
      toast({
        title: "Nueva alerta detectada",
        description: `Se han detectado ${alerts.length - lastAlertCount} nueva(s) alerta(s)`,
        variant: "default",
      })
    }
    setLastAlertCount(alerts.length)
  }, [alerts.length, lastAlertCount])

  useEffect(() => {
    return () => {
      if (refreshInterval) {
        clearInterval(refreshInterval)
      }
    }
  }, [refreshInterval])

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case "critical":
        return <AlertTriangle className="h-4 w-4 text-red-500" />
      case "warning":
        return <Info className="h-4 w-4 text-yellow-500" />
      case "info":
        return <CheckCircle className="h-4 w-4 text-blue-500" />
      default:
        return <Info className="h-4 w-4" />
    }
  }

  const getSeverityBadge = (severity: string) => {
    const variants = {
      critical: "destructive",
      warning: "default",
      info: "secondary",
    } as const

    return <Badge variant={variants[severity as keyof typeof variants] || "default"}>{severity.toUpperCase()}</Badge>
  }

  const filteredAlerts = useMemo(() => {
    const lowerSearchTerm = searchTerm.toLowerCase()
    return alerts.filter((alert) => {
      const matchesSearch =
        alert.message.toLowerCase().includes(lowerSearchTerm) ||
        (alert.networkName && alert.networkName.toLowerCase().includes(lowerSearchTerm)) || // Check networkName
        (alert.deviceSerial && alert.deviceSerial.toLowerCase().includes(lowerSearchTerm)) // Check deviceSerial

      const matchesOrg = selectedOrg === "all" || (alert.networkName && alert.networkName.includes(selectedOrg))
      const matchesNetwork = selectedNetwork === "all" || alert.networkId === selectedNetwork
      const matchesSeverity = selectedSeverity === "all" || alert.severity === selectedSeverity

      return matchesSearch && matchesOrg && matchesNetwork && matchesSeverity
    })
  }, [alerts, searchTerm, selectedOrg, selectedNetwork, selectedSeverity])

  // Pagination calculations
  const totalPages = Math.ceil(filteredAlerts.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedAlerts = filteredAlerts.slice(startIndex, endIndex)

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, selectedOrg, selectedNetwork, selectedSeverity])

  const alertStats = {
    critical: alerts.filter((a) => a.severity === "critical").length,
    warning: alerts.filter((a) => a.severity === "warning").length,
    info: alerts.filter((a) => a.severity === "info").length,
    total: alerts.length,
  }

  useEffect(() => {
    console.log(`🔄 Estado de alerts cambió: ${alerts.length} alertas`)
    // console.log("Alertas actuales:", alerts) // Can be too verbose, uncomment if needed
  }, [alerts])

  // Debounce search term
  useEffect(() => {
    const handler = setTimeout(() => {
      setSearchTerm(inputValue);
    }, 300); // 300ms debounce delay

    return () => {
      clearTimeout(handler);
    };
  }, [inputValue]); // Only re-run the effect if inputValue changes

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-4">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2 relative">
          <div className="absolute top-0 right-0">
            <ThemeToggle />
          </div>
          <div className="flex items-center justify-center gap-3">
            <div className="relative">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-blue-800 rounded-xl flex items-center justify-center shadow-lg">
                <svg
                  className="w-8 h-8 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                  />
                </svg>
              </div>
              <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white animate-pulse"></div>
            </div>
            <div className="text-center">
              <h1 className="text-4xl font-bold text-slate-800 dark:text-slate-100 tracking-tight">Meraki Dashboard</h1>
              <div className="text-sm text-blue-600 dark:text-blue-400 font-medium tracking-wider">
                NETWORK SECURITY
              </div>
            </div>
          </div>
          <p className="text-slate-600 dark:text-slate-400">Monitor de Alertas y Estado de Red</p>
        </div>

        {/* Connection Status & Controls */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wifi className="h-5 w-5" />
              Panel de Control
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-center gap-4">
              <Button onClick={connectToMeraki} disabled={isLoading} className="bg-green-600 hover:bg-green-700">
                {isLoading ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <Wifi className="h-4 w-4 mr-2" />}
                {isConnected ? "Reconectar" : "Conectar"}
              </Button>

              {isConnected && (
                <Button onClick={changeApiKey} variant="outline" size="sm">
                  Cambiar API Key
                </Button>
              )}

              {isConnected && (
                <Button
                  onClick={disconnectFromMeraki}
                  variant="outline"
                  size="sm"
                  className="text-red-600 hover:text-red-700"
                >
                  Desconectar
                </Button>
              )}

              <Button onClick={refreshAlerts} disabled={!isConnected || isLoading} variant="outline">
                <RefreshCw className="h-4 w-4 mr-2" />
                Actualizar
              </Button>

              {isConnected && (
                <Button
                  onClick={autoRefresh ? stopAutoRefresh : startAutoRefresh}
                  variant={autoRefresh ? "default" : "outline"}
                  className={autoRefresh ? "bg-blue-600 hover:bg-blue-700" : ""}
                >
                  {autoRefresh ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Auto ON
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Auto OFF
                    </>
                  )}
                </Button>
              )}

              {isConnected && (
                <Button
                  onClick={fetchAllHistoryData}
                  disabled={isLoading || isLoadingMore || loadedTimespan === FULL_HISTORY_TIMESPAN}
                  variant="outline"
                  className="bg-teal-50 hover:bg-teal-100 border-teal-200 dark:bg-teal-900/30 dark:hover:bg-teal-800/50 dark:border-teal-700"
                  title="Carga aproximadamente 1 año de historial. Puede ser lento."
                >
                  <Download className="h-4 w-4 mr-2" />
                  Cargar Historial Completo (lento)
                </Button>
              )}

              {isConnected && canLoadMore() && (
                <Button
                  onClick={loadMoreAlerts}
                  disabled={isLoadingMore}
                  variant="outline"
                  className="bg-orange-50 hover:bg-orange-100 border-orange-200"
                >
                  {isLoadingMore ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Cargando...
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4 mr-2" />
                      Cargar Más ({getTimespanText(getNextTimespan(loadedTimespan))})
                    </>
                  )}
                </Button>
              )}

              <Button onClick={exportAlerts} disabled={alerts.length === 0} variant="outline">
                <Download className="h-4 w-4 mr-2" />
                Exportar a Excel
              </Button>

              <Button onClick={clearAlerts} variant="outline" className="text-red-600 hover:text-red-700">
                <Trash2 className="h-4 w-4 mr-2" />
                Limpiar
              </Button>

              {process.env.NODE_ENV === "development" && (
                <Button
                  onClick={() => {
                    console.log("🐛 DEBUG INFO:")
                    console.log("- isConnected:", isConnected)
                    console.log("- alerts.length:", alerts.length)
                    console.log("- organizations.length:", organizations.length)
                    console.log("- networks.length:", networks.length)
                    console.log("- useTestData:", useTestData)
                    console.log("- alerts:", alerts)
                  }}
                  variant="outline"
                  size="sm"
                  className="bg-purple-100 hover:bg-purple-200"
                >
                  🐛 Debug
                </Button>
              )}

              <div className="ml-auto flex items-center gap-2">
                <Badge variant={isConnected ? "default" : "secondary"}>
                  {isConnected ? (autoRefresh ? "🔴 En Vivo" : "Conectado") : "Desconectado"}
                </Badge>
                {useTestData && (
                  <Badge variant="outline" className="text-orange-600">
                    Datos de Prueba
                  </Badge>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Fetch Status Messages */}
        {fetchStatusMessages.length > 0 && (
          <Card className="mt-4">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-orange-600 dark:text-orange-400 flex items-center">
                <Info className="h-5 w-5 mr-2" />
                Registro de Actividad y Advertencias
              </CardTitle>
              <Button variant="outline" size="sm" onClick={() => setFetchStatusMessages([])} className="ml-auto">
                <Trash2 className="h-3 w-3 mr-1" />
                Limpiar Log
              </Button>
            </CardHeader>
            <CardContent className="space-y-2 max-h-48 overflow-y-auto">
              {fetchStatusMessages.map((msg, index) => (
                <div
                  key={index}
                  className="text-sm p-2 bg-orange-50 dark:bg-orange-900/30 border border-orange-200 dark:border-orange-700 rounded-md"
                >
                  {/* Icon already in CardTitle, or add here if preferred per message */}
                  {msg}
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Críticas</CardTitle>
              <AlertTriangle className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600 mb-2">{alertStats.critical}</div>
              <div className="relative w-16 h-16 mx-auto mb-2">
                <svg className="w-16 h-16 transform -rotate-90" viewBox="0 0 36 36">
                  <path
                    className="text-gray-200"
                    stroke="currentColor"
                    strokeWidth="3"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 0 0 1 0 -31.831"
                  />
                  <path
                    className="text-red-500"
                    stroke="currentColor"
                    strokeWidth="3"
                    fill="none"
                    strokeDasharray={`${alertStats.total > 0 ? (alertStats.critical / alertStats.total) * 100 : 0}, 100`}
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 0 0 1 0 -31.831"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-xs font-semibold text-red-600">
                    {alertStats.total > 0 ? Math.round((alertStats.critical / alertStats.total) * 100) : 0}%
                  </span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground text-center">del total</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Advertencias</CardTitle>
              <Info className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600 mb-2">{alertStats.warning}</div>
              <div className="relative w-16 h-16 mx-auto mb-2">
                <svg className="w-16 h-16 transform -rotate-90" viewBox="0 0 36 36">
                  <path
                    className="text-gray-200"
                    stroke="currentColor"
                    strokeWidth="3"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 0 0 1 0 -31.831"
                  />
                  <path
                    className="text-yellow-500"
                    stroke="currentColor"
                    strokeWidth="3"
                    fill="none"
                    strokeDasharray={`${alertStats.total > 0 ? (alertStats.warning / alertStats.total) * 100 : 0}, 100`}
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 0 0 1 0 -31.831"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-xs font-semibold text-yellow-600">
                    {alertStats.total > 0 ? Math.round((alertStats.warning / alertStats.total) * 100) : 0}%
                  </span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground text-center">del total</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Información</CardTitle>
              <CheckCircle className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600 mb-2">{alertStats.info}</div>
              <div className="relative w-16 h-16 mx-auto mb-2">
                <svg className="w-16 h-16 transform -rotate-90" viewBox="0 0 36 36">
                  <path
                    className="text-gray-200"
                    stroke="currentColor"
                    strokeWidth="3"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 0 0 1 0 -31.831"
                  />
                  <path
                    className="text-blue-500"
                    stroke="currentColor"
                    strokeWidth="3"
                    fill="none"
                    strokeDasharray={`${alertStats.total > 0 ? (alertStats.info / alertStats.total) * 100 : 0}, 100`}
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 0 0 1 0 -31.831"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-xs font-semibold text-blue-600">
                    {alertStats.total > 0 ? Math.round((alertStats.info / alertStats.total) * 100) : 0}%
                  </span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground text-center">del total</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total</CardTitle>
              <Activity className="h-4 w-4 text-slate-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-700 mb-2">{alertStats.total}</div>
              <div className="relative w-16 h-16 mx-auto mb-2">
                <svg className="w-16 h-16 transform -rotate-90" viewBox="0 0 36 36">
                  <path
                    className="text-gray-200"
                    stroke="currentColor"
                    strokeWidth="3"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 0 0 1 0 -31.831"
                  />
                  {alertStats.total > 0 && (
                    <>
                      <path
                        className="text-red-500"
                        stroke="currentColor"
                        strokeWidth="3"
                        fill="none"
                        strokeDasharray={`${(alertStats.critical / alertStats.total) * 100}, 100`}
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 0 0 1 0 -31.831"
                      />
                      <path
                        className="text-yellow-500"
                        stroke="currentColor"
                        strokeWidth="3"
                        fill="none"
                        strokeDasharray={`${(alertStats.warning / alertStats.total) * 100}, 100`}
                        strokeDashoffset={`-${(alertStats.critical / alertStats.total) * 100}`}
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 0 0 1 0 -31.831"
                      />
                      <path
                        className="text-blue-500"
                        stroke="currentColor"
                        strokeWidth="3"
                        fill="none"
                        strokeDasharray={`${(alertStats.info / alertStats.total) * 100}, 100`}
                        strokeDashoffset={`-${((alertStats.critical + alertStats.warning) / alertStats.total) * 100}`}
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 0 0 1 0 -31.831"
                      />
                    </>
                  )}
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-xs font-semibold text-slate-700">100%</span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground text-center">Distribución</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle>Filtros</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <Input
                placeholder="Buscar alertas..."
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
              />

              <Select value={selectedOrg} onValueChange={setSelectedOrg}>
                <SelectTrigger>
                  <SelectValue placeholder="Organización" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las organizaciones</SelectItem>
                  {organizations.map((org) => (
                    <SelectItem key={org.id} value={org.name}>
                      {org.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={selectedNetwork} onValueChange={setSelectedNetwork}>
                <SelectTrigger>
                  <SelectValue placeholder="Red" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las redes</SelectItem>
                  {networks.map((network) => (
                    <SelectItem key={network.id} value={network.id}>
                      {network.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={selectedSeverity} onValueChange={setSelectedSeverity}>
                <SelectTrigger>
                  <SelectValue placeholder="Severidad" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las severidades</SelectItem>
                  <SelectItem value="critical">Crítica</SelectItem>
                  <SelectItem value="warning">Advertencia</SelectItem>
                  <SelectItem value="info">Información</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={loadedTimespan === FULL_HISTORY_TIMESPAN ? "full" : selectedTimespan.toString()}
                onValueChange={(value) => {
                  if (value === "full") {
                    // setLoadFullHistory(true); // loadFullHistory state is removed
                    fetchAllHistoryData();
                  } else {
                    // setLoadFullHistory(false); // loadFullHistory state is removed
                    const newTimespan = Number.parseInt(value)
                    setSelectedTimespan(newTimespan);
                    if (loadedTimespan !== newTimespan || loadedTimespan === FULL_HISTORY_TIMESPAN) {
                        // Reset loadedTimespan to the new standard timespan if it's different or if full history was loaded
                        setLoadedTimespan(newTimespan);
                        setAlerts([]); // Clear alerts to indicate a new period needs loading/refresh
                        setFetchStatusMessages(prev => [...prev, `Período cambiado a ${getTimespanText(newTimespan)}. Presiona 'Actualizar' o 'Reconectar' para cargar datos.`]);
                        toast({ title: "Período Cambiado", description: `Seleccionaste ${getTimespanText(newTimespan)}. Actualiza para ver las alertas.`});
                    }
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Período" />
                  {loadedTimespan === FULL_HISTORY_TIMESPAN && <span className="ml-2 text-xs text-muted-foreground">(Historial Completo)</span>}
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="3600">Última hora</SelectItem>
                  <SelectItem value="86400">Último día</SelectItem>
                  <SelectItem value="259200">Últimos 3 días</SelectItem>
                  <SelectItem value="604800">Última semana</SelectItem>
                  <SelectItem value="2592000">Último mes</SelectItem>
                  <SelectItem value="7776000">Últimos 3 meses</SelectItem>
                  <SelectItem value="full" disabled>Todo el historial disponible (Usar botón dedicado)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Alerts Table */}
        <Card>
          <CardHeader>
            <CardTitle>Alertas Activas</CardTitle>
            <CardDescription>
              Mostrando {paginatedAlerts.length} de {filteredAlerts.length} alertas (Página {currentPage} de{" "}
              {totalPages}) - Período cargado: {loadedTimespan === FULL_HISTORY_TIMESPAN ? "Historial Completo" : getTimespanText(loadedTimespan)}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8">
                <RefreshCw className="h-12 w-12 text-blue-500 mx-auto mb-4 animate-spin" />
                <h3 className="text-lg font-semibold mb-2">Cargando datos...</h3>
                <p className="text-muted-foreground">Conectando con Meraki API y obteniendo alertas</p>
              </div>
            ) : !isConnected ? (
              <div className="text-center py-8">
                <Wifi className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No conectado</h3>
                <p className="text-muted-foreground mb-4">Conecta con tu API Key de Meraki para ver las alertas</p>
                <Button onClick={() => setShowApiKeyDialog(true)}>
                  <Wifi className="h-4 w-4 mr-2" />
                  Conectar ahora
                </Button>
              </div>
            ) : alerts.length === 0 ? (
              <div className="text-center py-8">
                <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No hay alertas</h3>
                <p className="text-muted-foreground">
                  No se encontraron alertas. Esto puede significar que tu red está funcionando perfectamente.
                </p>
                <Button onClick={refreshAlerts} className="mt-4" variant="outline">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Intentar de nuevo
                </Button>
              </div>
            ) : filteredAlerts.length === 0 ? (
              <div className="text-center py-8">
                <Info className="h-12 w-12 text-blue-500 mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Sin resultados</h3>
                <p className="text-muted-foreground">
                  No se encontraron alertas que coincidan con los filtros actuales.
                </p>
                <p className="text-sm text-muted-foreground mt-2">Total de alertas disponibles: {alerts.length}</p>
              </div>
            ) : (
              <>
                {/* Pagination Controls */}
                {filteredAlerts.length > 0 && (
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">
                        Mostrando {startIndex + 1} a {Math.min(endIndex, filteredAlerts.length)} de{" "}
                        {filteredAlerts.length} alertas
                      </span>
                      <Select
                        value={itemsPerPage.toString()}
                        onValueChange={(value) => {
                          setItemsPerPage(Number(value))
                          setCurrentPage(1)
                        }}
                      >
                        <SelectTrigger className="w-20">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="5">5</SelectItem>
                          <SelectItem value="10">10</SelectItem>
                          <SelectItem value="25">25</SelectItem>
                          <SelectItem value="50">50</SelectItem>
                          <SelectItem value="100">100</SelectItem>
                        </SelectContent>
                      </Select>
                      <span className="text-sm text-muted-foreground">por página</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(1)}
                        disabled={currentPage === 1}
                      >
                        Primera
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(currentPage - 1)}
                        disabled={currentPage === 1}
                      >
                        Anterior
                      </Button>

                      <div className="flex items-center gap-1">
                        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                          let pageNum
                          if (totalPages <= 5) {
                            pageNum = i + 1
                          } else if (currentPage <= 3) {
                            pageNum = i + 1
                          } else if (currentPage >= totalPages - 2) {
                            pageNum = totalPages - 4 + i
                          } else {
                            pageNum = currentPage - 2 + i
                          }

                          return (
                            <Button
                              key={pageNum}
                              variant={currentPage === pageNum ? "default" : "outline"}
                              size="sm"
                              className="w-8 h-8 p-0"
                              onClick={() => setCurrentPage(pageNum)}
                            >
                              {pageNum}
                            </Button>
                          )
                        })}
                      </div>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(currentPage + 1)}
                        disabled={currentPage === totalPages}
                      >
                        Siguiente
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(totalPages)}
                        disabled={currentPage === totalPages}
                      >
                        Última
                      </Button>
                    </div>
                  </div>
                )}
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Severidad</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Mensaje</TableHead>
                        <TableHead>Red</TableHead>
                        <TableHead>Dispositivo</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedAlerts.map((alert) => (
                        <TableRow key={alert.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {getSeverityIcon(alert.severity)}
                              {getSeverityBadge(alert.severity)}
                            </div>
                          </TableCell>
                          <TableCell className="font-medium">
                            {alert.type.replace("_", " ").replace(/\b\w/g, (l) => l.toUpperCase())}
                          </TableCell>
                          <TableCell className="max-w-xs truncate">{alert.message}</TableCell>
                          <TableCell>{alert.networkName}</TableCell>
                          <TableCell className="font-mono text-sm">{alert.deviceSerial}</TableCell>
                          <TableCell>
                            <Badge variant={alert.status === "active" ? "destructive" : "secondary"}>
                              {alert.status.toUpperCase()}
                            </Badge>
                          </TableCell>
                          <TableCell>{new Date(alert.timestamp).toLocaleString()}</TableCell>
                          <TableCell>
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button variant="outline" size="sm" onClick={() => setSelectedAlert(alert)}>
                                  Ver Detalles
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="max-w-2xl">
                                <DialogHeader>
                                  <DialogTitle>Detalles de la Alerta</DialogTitle>
                                  <DialogDescription>Información completa de la alerta seleccionada</DialogDescription>
                                </DialogHeader>
                                {selectedAlert && (
                                  <div className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                      <div>
                                        <label className="text-sm font-medium">ID de Alerta</label>
                                        <p className="text-sm text-muted-foreground">{selectedAlert.id}</p>
                                      </div>
                                      <div>
                                        <label className="text-sm font-medium">Tipo</label>
                                        <p className="text-sm text-muted-foreground">{selectedAlert.type}</p>
                                      </div>
                                      <div>
                                        <label className="text-sm font-medium">Severidad</label>
                                        <div className="flex items-center gap-2 mt-1">
                                          {getSeverityIcon(selectedAlert.severity)}
                                          {getSeverityBadge(selectedAlert.severity)}
                                        </div>
                                      </div>
                                      <div>
                                        <label className="text-sm font-medium">Estado</label>
                                        <p className="text-sm text-muted-foreground">{selectedAlert.status}</p>
                                      </div>
                                    </div>
                                    <div>
                                      <label className="text-sm font-medium">Mensaje</label>
                                      <p className="text-sm text-muted-foreground">{selectedAlert.message}</p>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                      <div>
                                        <label className="text-sm font-medium">Red</label>
                                        <p className="text-sm text-muted-foreground">{selectedAlert.networkName}</p>
                                      </div>
                                      <div>
                                        <label className="text-sm font-medium">Dispositivo</label>
                                        <p className="text-sm text-muted-foreground font-mono">
                                          {selectedAlert.deviceSerial}
                                        </p>
                                      </div>
                                    </div>
                                    <div>
                                      <label className="text-sm font-medium">Fecha y Hora</label>
                                      <p className="text-sm text-muted-foreground">
                                        {new Date(selectedAlert.timestamp).toLocaleString()}
                                      </p>
                                    </div>
                                  </div>
                                )}
                              </DialogContent>
                            </Dialog>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </CardContent>
        </Card>
        {/* API Key Dialog */}
        <Dialog open={showApiKeyDialog} onOpenChange={setShowApiKeyDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Configurar API Key de Meraki
              </DialogTitle>
              <DialogDescription>
                Ingresa tu API Key de Meraki Dashboard para conectarte. Puedes encontrarla en tu perfil de Meraki
                Dashboard.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="apikey" className="text-sm font-medium">
                  API Key
                </label>
                <Input
                  id="apikey"
                  type="password"
                  placeholder="Ingresa tu API Key de Meraki..."
                  value={tempApiKey}
                  onChange={(e) => setTempApiKey(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleApiKeySubmit()
                    }
                  }}
                />
                <p className="text-xs text-muted-foreground">
                  El API Key debe tener exactamente 40 caracteres hexadecimales y se mantendrá seguro en tu sesión.
                </p>
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowApiKeyDialog(false)
                    setTempApiKey("")
                  }}
                >
                  Cancelar
                </Button>
                <Button onClick={handleApiKeySubmit} disabled={!tempApiKey.trim()}>
                  {apiKey ? "Actualizar" : "Conectar"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
