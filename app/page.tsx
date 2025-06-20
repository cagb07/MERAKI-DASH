"use client"

import { useState, useEffect } from "react"
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

  const connectToMeraki = async () => {
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

      // Obtener redes de todas las organizaciones
      console.log("🌐 Obteniendo redes...")
      const allNetworks: Network[] = []
      for (const org of organizations) {
        try {
          const networksResult = await getNetworks(apiKey, org.id)
          if (networksResult.success) {
            const orgNetworks = networksResult.data.map((net) => ({
              id: net.id,
              name: net.name,
              organizationId: net.organizationId,
            }))
            allNetworks.push(...orgNetworks)
            console.log(`📡 Redes en ${org.name}: ${orgNetworks.length}`)
          }
        } catch (error) {
          console.error(`❌ Error obteniendo redes de ${org.name}:`, error)
        }
      }
      console.log(`📡 Total redes: ${allNetworks.length}`)
      setNetworks(allNetworks)

      // Generar alertas de prueba inmediatamente para mostrar algo
      console.log("🧪 Generando alertas de prueba para mostrar datos inmediatamente...")
      const testAlerts = await generateTestAlerts(
        organizations[0]?.id || "demo_org",
        allNetworks.map((n) => n.id),
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
      const realAlerts: Alert[] = []
      let hasRealAlerts = false

      for (const org of organizations) {
        try {
          console.log(`🔍 Procesando alertas de: ${org.name}`)
          const alertsResult = await getAlerts(apiKey, org.id, 86400) // Solo 24 horas inicialmente

          console.log(`📊 Resultado para ${org.name}:`, alertsResult)

          if (alertsResult.success && alertsResult.data.length > 0) {
            hasRealAlerts = true
            const orgAlerts = alertsResult.data.map((alert) => ({
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
            realAlerts.push(...orgAlerts)
            console.log(`✅ Alertas reales agregadas de ${org.name}: ${orgAlerts.length}`)
          } else {
            console.log(`❌ Sin alertas reales en ${org.name}`)
          }
        } catch (orgError) {
          console.error(`❌ Error obteniendo alertas de ${org.name}:`, orgError)
        }
      }

      // Si encontramos alertas reales, reemplazar las de prueba
      if (hasRealAlerts && realAlerts.length > 0) {
        console.log(`🎯 Reemplazando con ${realAlerts.length} alertas reales`)
        setAlerts(realAlerts)
        setUseTestData(false)

        toast({
          title: "Alertas reales cargadas",
          description: `Se encontraron ${realAlerts.length} alertas reales de las últimas 24 horas`,
        })
      } else {
        console.log(`🧪 Manteniendo ${initialAlerts.length} alertas de prueba`)
      }
    } catch (error) {
      console.error("❌ Error en conexión:", error)

      // En caso de error, al menos mostrar datos de prueba
      console.log("🧪 Generando alertas de prueba debido a error...")
      const fallbackAlerts = await generateTestAlerts("error_org", ["error_network"])
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
      console.log(`🔄 Cargando más alertas hasta ${timespanText}...`)

      const allAlerts: Alert[] = []
      let hasRealAlerts = false

      for (const org of organizations) {
        try {
          console.log(`🔍 Cargando más alertas de: ${org.name}`)
          const alertsResult = await getAlerts(apiKey, org.id, nextTimespan)

          if (alertsResult.success && alertsResult.data.length > 0) {
            hasRealAlerts = true
            const orgAlerts = alertsResult.data.map((alert) => ({
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
            allAlerts.push(...orgAlerts)
          }
        } catch (orgError) {
          console.error(`❌ Error cargando más alertas de ${org.name}:`, orgError)
        }
      }

      // Si no hay alertas reales y estamos usando datos de prueba, generar más
      if (!hasRealAlerts && useTestData) {
        const networkIds = networks.map((n) => n.id)
        const testAlerts = await generateTestAlerts(organizations[0]?.id || "test_org", networkIds)
        allAlerts.push(
          ...testAlerts.map((alert) => ({
            id: alert.id,
            type: alert.type,
            severity: alert.severity,
            message: alert.message,
            timestamp: alert.timestamp,
            networkId: alert.networkId,
            networkName: alert.networkName,
            deviceSerial: alert.deviceSerial,
            status: alert.status,
          })),
        )
      }

      // Eliminar duplicados basados en ID
      const uniqueAlerts = allAlerts.filter((alert, index, self) => index === self.findIndex((a) => a.id === alert.id))

      setAlerts(uniqueAlerts)
      setLoadedTimespan(nextTimespan)

      toast({
        title: "Más alertas cargadas",
        description: `Se han cargado ${uniqueAlerts.length} alertas de ${timespanText}${useTestData ? " (datos de prueba)" : ""}`,
      })
    } catch (error) {
      toast({
        title: "Error",
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
      const allAlerts: Alert[] = []
      let hasRealAlerts = false

      // Obtener alertas actualizadas de todas las organizaciones
      for (const org of organizations) {
        try {
          const alertsResult = await getAlerts(apiKey, org.id, loadedTimespan)

          if (alertsResult.success && alertsResult.data.length > 0) {
            hasRealAlerts = true
            const orgAlerts = alertsResult.data.map((alert) => ({
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
            allAlerts.push(...orgAlerts)
          }
        } catch (error) {
          console.error(`Error refrescando alertas de ${org.name}:`, error)
        }
      }

      // Si no hay alertas reales, mantener las de prueba o generar nuevas
      if (!hasRealAlerts) {
        const networkIds = networks.map((n) => n.id)
        const testAlerts = await generateTestAlerts(organizations[0]?.id || "test_org", networkIds)
        allAlerts.push(
          ...testAlerts.map((alert) => ({
            id: alert.id,
            type: alert.type,
            severity: alert.severity,
            message: alert.message,
            timestamp: alert.timestamp,
            networkId: alert.networkId,
            networkName: alert.networkName,
            deviceSerial: alert.deviceSerial,
            status: alert.status,
          })),
        )
        setUseTestData(true)
      } else {
        setUseTestData(false)
      }

      setAlerts(allAlerts)
      toast({
        title: "Alertas actualizadas",
        description: `Se han cargado ${allAlerts.length} alertas${useTestData ? " (datos de prueba)" : ""} desde Meraki API`,
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

  const filteredAlerts = alerts.filter((alert) => {
    const matchesSearch =
      alert.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
      alert.networkName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      alert.deviceSerial.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesOrg = selectedOrg === "all" || alert.networkName.includes(selectedOrg)
    const matchesNetwork = selectedNetwork === "all" || alert.networkId === selectedNetwork
    const matchesSeverity = selectedSeverity === "all" || alert.severity === selectedSeverity

    return matchesSearch && matchesOrg && matchesNetwork && matchesSeverity
  })

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
