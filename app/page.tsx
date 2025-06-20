"use client"

import { useState, useEffect, useMemo } from "react" // Added useMemo
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
import { validateApiKey, getNetworks, getAlerts, generateTestAlerts } from "@/lib/meraki-api"

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
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null)
  const [selectedTimespan, setSelectedTimespan] = useState<number>(86400) // 24 horas por defecto
  const [loadFullHistory, setLoadFullHistory] = useState(false)
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

  const [loadingMessage, setLoadingMessage] = useState<string | null>(null)
  const [showFallbackNetworkMessage, setShowFallbackNetworkMessage] = useState(false)

  const connectToMeraki = async () => {
    if (!apiKey) {
      setShowApiKeyDialog(true)
      return
    }

    setIsLoading(true)
    setShowFallbackNetworkMessage(false) // Reset fallback message on new connection attempt
    setLoadingMessage("Iniciando conexión...")
    console.log("🚀 Iniciando conexión a Meraki...")

    try {
      // Limpiar estado anterior
      setAlerts([])
      setOrganizations([])
      setNetworks([])
      setUseTestData(false)
      setLoadedTimespan(86400) // Reset a 24 horas

      // Validar API Key y obtener organizaciones
      setLoadingMessage("Validando API Key...")
      console.log("🔑 Validando API Key...")
      const validation = await validateApiKey(apiKey)

      if (!validation.success || !validation.organizations) {
        const errorMsg = validation.error || "Fallo al validar API key o no se encontraron organizaciones."
        toast({ title: "Error de Validación", description: errorMsg, variant: "destructive" })
        setIsLoading(false)
        setLoadingMessage(null)
        return;
      }

      setLoadingMessage("Obteniendo organizaciones...")
      const orgs = validation.organizations.map((org) => ({ id: org.id, name: org.name }))
      console.log(`🏢 Organizaciones encontradas: ${orgs.length}`)
      setOrganizations(orgs)
      setIsConnected(true) // Set connected early

      if (orgs.length > 0) {
        const defaultOrgId = orgs[0].id
        const defaultOrgName = orgs[0].name;
        setSelectedOrg(defaultOrgId)
        console.log(`🚀 Organización por defecto seleccionada: ${defaultOrgName} (${defaultOrgId})`)
        await loadDataForOrganization(defaultOrgId, defaultOrgName)
      } else {
        toast({
          title: "Sin organizaciones",
          description: "No se encontraron organizaciones para esta API Key.",
          variant: "destructive",
        })
        setIsLoading(false)
        setLoadingMessage(null)
      }
    } catch (error) {
      console.error("❌ Error en conexión:", error)
      setLoadingMessage(null)
      const errorMsg = error instanceof Error ? error.message : "Error desconocido durante la conexión."
      toast({ title: "Error de Conexión", description: errorMsg, variant: "destructive" })
      // En caso de error, al menos mostrar datos de prueba
      console.log("🧪 Generando alertas de prueba debido a error de conexión...")
      const fallbackAlerts = await generateTestAlerts("error_org", ["error_network"])
      const errorAlerts = fallbackAlerts.map((alert) => ({
        id: alert.id,
        type: alert.type,
        severity: alert.severity,
        message: `[CON_ERROR] ${alert.message}`,
        timestamp: alert.timestamp,
        networkId: alert.networkId,
        networkName: alert.networkName,
        deviceSerial: alert.deviceSerial,
        status: alert.status,
      }))
      setAlerts(errorAlerts)
      setUseTestData(true)
      setIsLoading(false) // Already set loadingMessage to null
    }
    // setLoadingMessage(null) // Ensure loading message is cleared on successful completion too, if not done by loadDataForOrg
    console.log("🏁 Proceso de conexión finalizado")
  }

  // Nueva función para cargar datos de una organización específica
  const loadDataForOrganization = async (orgId: string, orgName?: string) => {
    if (!apiKey) {
      toast({ title: "API Key no configurada", variant: "destructive" })
      setLoadingMessage(null)
      return
    }
    const currentOrgName = orgName || organizations.find(o => o.id === orgId)?.name || orgId;
    console.log(`🔄 Cargando datos para la organización: ${currentOrgName}`)
    setIsLoading(true)
    setShowFallbackNetworkMessage(false) // Reset fallback message for new org load
    setLoadingMessage(`Cargando datos para ${currentOrgName}...`)

    setNetworks([])
    setAlerts([])
    setUseTestData(true)

    try {
      setLoadingMessage(`Obteniendo redes para ${currentOrgName}...`)
      console.log(`🧪 Generando alertas de prueba iniciales para ${currentOrgName}...`)
      const tempNetworkIds = [`org-placeholder-net-${orgId}`];
      const initialTestAlerts = await generateTestAlerts(orgId, tempNetworkIds);
      setAlerts(initialTestAlerts.map(alert => ({ ...alert, message: `[INITIAL_TEST] ${alert.message}` })));

      console.log(`🌐 Obteniendo redes para ${currentOrgName} (${orgId})...`)
      const networksResult = await getNetworks(apiKey, orgId)
      let orgNetworks: Network[] = []
      if (networksResult.success && networksResult.data) {
        orgNetworks = networksResult.data.map((net) => ({
          id: net.id,
          name: net.name,
          organizationId: net.organizationId,
        }))
        setNetworks(orgNetworks)
        console.log(`📡 Redes encontradas en ${currentOrgName}: ${orgNetworks.length}`)

        if (orgNetworks.length > 0) {
            const networkSpecificTestAlerts = await generateTestAlerts(orgId, orgNetworks.map(n => n.id));
            setAlerts(networkSpecificTestAlerts.map(alert => ({ ...alert, message: `[NET_TEST] ${alert.message}` })));
        }
      } else {
        console.error(`❌ Error obteniendo redes de ${currentOrgName}: ${networksResult.error}`)
        toast({
          title: `Error obteniendo redes para ${currentOrgName}`,
          description: networksResult.error || "No se pudieron cargar las redes.",
          variant: "destructive",
        })
      }

      setLoadingMessage(`Obteniendo alertas para ${currentOrgName}...`)
      console.log(`🚨 Obteniendo alertas reales para ${currentOrgName} (${orgId}) (últimas 24 horas)...`)
      const alertsResult = await getAlerts(apiKey, orgId, 86400)

      if (alertsResult.success && alertsResult.data) { // Check data existence
        if (alertsResult.data.length > 0) {
          const realAlerts = alertsResult.data.map((alert) => ({
          id: alert.id,
          type: alert.type,
          severity: alert.severity,
          message: alert.message,
          timestamp: alert.timestamp,
          networkId: alert.networkId,
          networkName: networks.find(n => n.id === alert.networkId)?.name || alert.networkName || "N/A", // Populate networkName
          deviceSerial: alert.deviceSerial || "N/A",
            id: alert.id,
            type: alert.type,
            severity: alert.severity,
            message: alert.message,
            timestamp: alert.timestamp,
            networkId: alert.networkId,
            networkName: networks.find(n => n.id === alert.networkId)?.name || alert.networkName || "N/A",
            deviceSerial: alert.deviceSerial || "N/A",
            status: alert.status,
          }))
          setAlerts(realAlerts)
          setUseTestData(false)
          console.log(`✅ ${realAlerts.length} alertas reales cargadas para ${currentOrgName}`)
          toast({
            title: "Datos cargados",
            description: `Se cargaron ${realAlerts.length} alertas reales para ${currentOrgName}.`,
          })
        } else { // No real alerts found
           console.log(`🧪 No se encontraron alertas reales para ${currentOrgName}. Mostrando datos de prueba.`)
           setUseTestData(true)
           const finalTestAlerts = await generateTestAlerts(orgId, orgNetworks.map(n => n.id));
           setAlerts(finalTestAlerts.map(alert => ({ ...alert, message: `[NO_REAL_ALERTS_TEST] ${alert.message}` })));
           toast({
             title: "Sin alertas reales",
             description: `No se encontraron alertas reales para ${currentOrgName} en las últimas 24 horas. Mostrando datos de prueba.`,
           })
        }
        // Handle fallback message
        if (alertsResult.usedNetworkFallback) {
          setShowFallbackNetworkMessage(true);
          toast({
            title: "Modo de carga alternativo activado",
            description: `Obteniendo alertas red por red para ${currentOrgName}. Esto podría tardar más.`,
            variant: "default",
          });
        }
      } else { // alertsResult.success is false
        console.error(`❌ Error obteniendo alertas para ${currentOrgName}: ${alertsResult.error}`)
        toast({ title: `Error obteniendo alertas para ${currentOrgName}`, description: alertsResult.error, variant: "destructive"})
        // Keep test data
        setUseTestData(true);
        const errorFallbackAlerts = await generateTestAlerts(orgId, orgNetworks.map(n => n.id) || ["error_net_placeholder"]);
        setAlerts(errorFallbackAlerts.map(alert => ({ ...alert, message: `[ALERT_LOAD_ERR_TEST] ${alert.message}` })));
      }
    } catch (error) {
      console.error(`❌ Excepción cargando datos para ${currentOrgName} (${orgId}):`, error)
      const errorMsg = error instanceof Error ? error.message : "Error desconocido."
      toast({ title: "Error Crítico", description: `Error cargando datos para ${currentOrgName}: ${errorMsg}`, variant: "destructive"})
      setUseTestData(true);
      const criticalErrorAlerts = await generateTestAlerts(orgId, ["critical_error_placeholder"]);
      setAlerts(criticalErrorAlerts.map(alert => ({ ...alert, message: `[CRITICAL_LOAD_ERR_TEST] ${alert.message}` })));
    } finally {
      setIsLoading(false)
      setLoadingMessage(null)
      console.log(`🏁 Proceso de carga para ${currentOrgName} (${orgId}) finalizado.`)
    }
  }

  const loadMoreAlerts = async () => {
    if (!isConnected || !apiKey || isLoadingMore || selectedOrg === "all" || !selectedOrg) return // Ensure an org is selected

    // Mostrar advertencia antes de cargar más datos
    const nextTimespan = getNextTimespan(loadedTimespan)
    const t1ISO = new Date(Date.now() - loadedTimespan * 1000).toISOString()
    const t0ISO = new Date(Date.now() - nextTimespan * 1000).toISOString()

    const timespanText = `desde ${new Date(t0ISO).toLocaleDateString()} hasta ${new Date(t1ISO).toLocaleDateString()}`
    const estimatedTime = getEstimatedLoadTime(nextTimespan - loadedTimespan) // Estimate for the additional window

    const confirmed = window.confirm(
      `¿Deseas cargar alertas ${timespanText}?\n\n` +
        `⚠️ ADVERTENCIA: Esto puede tomar ${estimatedTime} (aprox.) para el nuevo período.\n\n` +
        `Rango de carga: ${getTimespanText(nextTimespan - loadedTimespan)} adicionales`,
    )

    if (!confirmed) return

    setIsLoadingMore(true)
    // setLoadingMessage(`Cargando más alertas (${timespanText})...`); // Optional: if you want granular message for "load more" too

    try {
      console.log(`🔄 Cargando más alertas para ${selectedOrg} en el rango t0: ${t0ISO}, t1: ${t1ISO}...`)

      let newFetchedAlerts: Alert[] = []
      let hasRealAlerts = false
      let fetchAttempted = false;

      const orgToLoad = organizations.find(o => o.id === selectedOrg)
      if (orgToLoad) {
        fetchAttempted = true;
        const alertsResult = await getAlerts(apiKey, orgToLoad.id, undefined, t0ISO, t1ISO)

        if (alertsResult.success && alertsResult.data) { // Check data existence
           if (alertsResult.data.length > 0) {
            hasRealAlerts = true
            const fetchedOrgAlerts = alertsResult.data.map((alert) => ({
              id: alert.id,
              type: alert.type,
              severity: alert.severity,
              message: alert.message,
              timestamp: alert.timestamp,
              networkId: alert.networkId,
              networkName: networks.find(n => n.id === alert.networkId)?.name || alert.networkName || "N/A",
              deviceSerial: alert.deviceSerial || "N/A",
              status: alert.status,
            }))
            newFetchedAlerts.push(...fetchedOrgAlerts)
            console.log(`✅ ${fetchedOrgAlerts.length} alertas adicionales reales cargadas para ${orgToLoad.name}`)
          }
          // Handle fallback message for loadMore as well
          if (alertsResult.usedNetworkFallback && !showFallbackNetworkMessage) { // Show only if not already shown
            setShowFallbackNetworkMessage(true); // Persist the message
            toast({
              title: "Modo de carga alternativo activado",
              description: `Obteniendo alertas red por red para ${orgToLoad.name}. Esto podría tardar más.`,
              variant: "default",
            });
          }
        } else if (!alertsResult.success) { // alertsResult.success is false
          console.error(`❌ Error obteniendo más alertas de ${orgToLoad.name}: ${alertsResult.error}`)
          toast({
            title: "Error al cargar más alertas",
            description: alertsResult.error || "No se pudieron cargar más alertas.",
            variant: "destructive",
          })
        }
      }

      if (fetchAttempted && !hasRealAlerts && useTestData && orgToLoad) {
        console.log("🧪 Generando más alertas de prueba para el nuevo rango...")
        const networkIds = networks.map((n) => n.id).length > 0 ? networks.map((n) => n.id) : [`more-test-net-${selectedOrg}`];
        const testAlerts = await generateTestAlerts(selectedOrg, networkIds, nextTimespan - loadedTimespan);
        const mappedTestAlerts = testAlerts.map((alert) => ({ ...alert, message: `[MORE_TEST_RANGE] ${alert.message}`}));
        newFetchedAlerts.push(...mappedTestAlerts);
        console.log(`🧪 ${mappedTestAlerts.length} alertas de prueba adicionales generadas.`)
      }

      if (newFetchedAlerts.length > 0) {
        const currentAlertCount = alerts.length;
        setAlerts(prevAlerts => {
          const existingAlertIds = new Set(prevAlerts.map(a => a.id));
          const uniqueNewAlerts = newFetchedAlerts.filter(a => !existingAlertIds.has(a.id));
          return [...prevAlerts, ...uniqueNewAlerts];
        });
        setLoadedTimespan(nextTimespan);
        toast({
          title: "Más alertas cargadas",
          description: `Se han añadido ${newFetchedAlerts.length} alertas ${timespanText}${!hasRealAlerts && useTestData ? " (datos de prueba)" : ""}. Total: ${currentAlertCount + newFetchedAlerts.filter(a => !alerts.find(pa => pa.id === a.id)).length}`,
        });
      } else if (fetchAttempted) { // Only show "no more alerts" if a fetch was actually made
        toast({
          title: "No más alertas",
          description: `No se encontraron alertas adicionales en el rango ${timespanText}.`,
        });
      }
    } catch (error) {
      console.error("❌ Error en loadMoreAlerts:", error);
      const errorMsg = error instanceof Error ? error.message : "Error desconocido."
      toast({ title: "Error", description: `No se pudieron cargar más alertas: ${errorMsg}`, variant: "destructive" })
    } finally {
      setIsLoadingMore(false)
      // setLoadingMessage(null); // Clear "load more" specific message if used
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
    return loadedTimespan < 7776000 && !useTestData
  }

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
    setShowFallbackNetworkMessage(false) // Reset on disconnect
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
    if (!isConnected || !apiKey) return

    setIsLoading(true)
    try {
      // Refresh alerts only for the currently selected organization
      if (selectedOrg && selectedOrg !== "all") {
        await loadDataForOrganization(selectedOrg); // Re-load data for the current org
        toast({
            title: "Alertas actualizadas",
            description: `Se han actualizado las alertas para la organización seleccionada.`,
        });
      } else {
        // Handle case where "all" is selected or no org is selected - perhaps refresh the first org or do nothing
        // For now, let's prompt to select an organization or refresh the first one if available
        if (organizations.length > 0) {
            await loadDataForOrganization(organizations[0].id);
             toast({
                title: "Alertas actualizadas",
                description: `Se han actualizado las alertas para ${organizations[0].name} (primera organización).`,
            });
        } else {
            toast({
                title: "No se pueden actualizar alertas",
                description: "Por favor, conecta y selecciona una organización primero.",
                variant: "destructive",
            });
        }
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudieron actualizar las alertas desde Meraki API",
      })
    } catch (error) {
      toast({
        title: "Error",
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
    if (alerts.length > lastAlertCount && lastAlertCount > 0 && !isLoading) { // Avoid sound during initial load
      playAlertSound()
      toast({
        title: "Nueva alerta detectada",
        description: `Se han detectado ${alerts.length - lastAlertCount} nueva(s) alerta(s)`,
        variant: "default",
      })
    }
    setLastAlertCount(alerts.length)
  }, [alerts, lastAlertCount, isLoading]) // Added isLoading to dependencies

  useEffect(() => {
    return () => {
      if (refreshInterval) {
        clearInterval(refreshInterval)
      }
    }
  }, [refreshInterval])

  // useEffect to handle changes in selectedOrg
  useEffect(() => {
    if (selectedOrg && selectedOrg !== "all" && apiKey && isConnected) {
      console.log(`Org seleccionada cambió a: ${selectedOrg}. Cargando datos...`)
      // Clear previous data for a smoother transition (optional, loadDataForOrganization also clears)
      // setAlerts([]);
      // setNetworks([]);
      const orgName = organizations.find(o => o.id === selectedOrg)?.name;
      loadDataForOrganization(selectedOrg, orgName);
    } else if (selectedOrg === "all" && isConnected) {
      // Handle "all organizations" selection
      setShowFallbackNetworkMessage(false); // Reset fallback message
      // For now, we are optimizing away from loading all orgs initially.
      // You might want to clear data or load data for the first org.
      // setAlerts([]);
      // setNetworks([]);
      // if (organizations.length > 0) {
      //   loadDataForOrganization(organizations[0].id);
      //   setSelectedOrg(organizations[0].id); // Switch to the first org
      // }
      console.log("Selección 'Todas las organizaciones' - comportamiento por definir o desactivar carga masiva.")
      // For now, do nothing or clear, as initial load is per-org
       setAlerts([]);
       setNetworks([]);
       setUseTestData(false); // No data to show
       toast({
         title: "Seleccione una organización",
         description: "Por favor, elija una organización específica para ver sus alertas.",
       });
    }
  }, [selectedOrg, apiKey, isConnected, organizations]); // Added organizations to dependency for the "all" case

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
    console.log("Memoizing filteredAlerts...", {
      alertsLength: alerts.length,
      searchTerm,
      selectedOrg,
      selectedNetwork,
      selectedSeverity,
      networksLength: networks.length,
    });
    return alerts.filter((alert) => {
      const organizationIdForAlert = networks.find(n => n.id === alert.networkId)?.organizationId;

      const matchesSearch =
        alert.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
        alert.networkName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (alert.deviceSerial && alert.deviceSerial.toLowerCase().includes(searchTerm.toLowerCase()));

      // Handle selectedOrg being an org ID or "all" / "Seleccione Organización..."
      // The value "all" is used by the SelectItem placeholder.
      const matchesOrg =
        !selectedOrg || selectedOrg === "all"
          ? true
          : organizationIdForAlert === selectedOrg;

      const matchesNetwork = selectedNetwork === "all" || alert.networkId === selectedNetwork;
      const matchesSeverity = selectedSeverity === "all" || alert.severity === selectedSeverity;

      return matchesSearch && matchesOrg && matchesNetwork && matchesSeverity;
    });
  }, [alerts, searchTerm, selectedOrg, selectedNetwork, selectedSeverity, networks]);

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
    console.log("Alertas actuales:", alerts)
  }, [alerts])

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
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />

              <Select value={selectedOrg} onValueChange={(value) => setSelectedOrg(value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Organización" />
                </SelectTrigger>
                <SelectContent>
                  {/* Option to de-select or view "all" (behavior TBD) */}
                  <SelectItem value="all">Seleccione Organización...</SelectItem>
                  {organizations.map((org) => (
                    <SelectItem key={org.id} value={org.id}> {/* Ensure value is org.id */}
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
                  {/* Networks are now filtered by selectedOrg, so this list will be relevant */}
                  {networks.map((network) => (
                    <SelectItem key={network.id} value={network.id}>
                      {network.name} ({network.id}) {/* Displaying ID can be useful for debugging */}
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
                value={loadFullHistory ? "full" : selectedTimespan.toString()}
                onValueChange={(value) => {
                  if (value === "full") {
                    setLoadFullHistory(true)
                  } else {
                    setLoadFullHistory(false)
                    setSelectedTimespan(Number.parseInt(value))
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Período" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="3600">Última hora</SelectItem>
                  <SelectItem value="86400">Último día</SelectItem>
                  <SelectItem value="259200">Últimos 3 días</SelectItem>
                  <SelectItem value="604800">Última semana</SelectItem>
                  <SelectItem value="2592000">Último mes</SelectItem>
                  <SelectItem value="7776000">Últimos 3 meses</SelectItem>
                  <SelectItem value="full">Todo el historial disponible</SelectItem>
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
              {totalPages}) - Período cargado: {getTimespanText(loadedTimespan)}
              {showFallbackNetworkMessage && (
                <p className="text-sm text-orange-600 mt-1">
                  Nota: Las alertas se están cargando individualmente por red debido a limitaciones de la API para esta organización. Este proceso puede tardar más.
                </p>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8">
                <RefreshCw className="h-12 w-12 text-blue-500 mx-auto mb-4 animate-spin" />
                <h3 className="text-lg font-semibold mb-2">{loadingMessage || "Cargando datos..."}</h3>
                <p className="text-muted-foreground">Conectando con Meraki API y obteniendo información.</p>
                {showFallbackNetworkMessage && loadingMessage && loadingMessage.includes("alertas") && (
                   <p className="text-sm text-orange-500 mt-2">
                     El modo de carga alternativo está activo. Esto puede tomar más tiempo.
                   </p>
                )}
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
