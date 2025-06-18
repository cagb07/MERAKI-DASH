"use client"

import { useState, useEffect, useCallback } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button" // Keep for AlertDetailsDialog if any Button is used there directly
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { AlertTriangle, CheckCircle, Info } from "lucide-react" // Keep for getSeverityIcon and AlertDetailsDialog
import { toast } from "@/hooks/use-toast"
import { ThemeToggle } from "@/components/theme-toggle"

// Import new components
import StatsCards from "@/components/dashboard/StatsCards"
import AlertFilters from "@/components/dashboard/AlertFilters"
import AlertsTable from "@/components/dashboard/AlertsTable"
import ApiKeyDialog from "@/components/dashboard/ApiKeyDialog"
import ControlPanel from "@/components/dashboard/ControlPanel"

// Import types and API functions from lib/meraki-api
import {
  type Alert,
  type Organization,
  type Network,
  connectAndFetchInitialData,
  fetchLatestAlerts,
} from "@/lib/meraki-api"


export default function MerakiDashboard() {
  // State for various data pieces
  const [alerts, setAlerts] = useState<Alert[]>([]) // Stores all alerts fetched from the API
  const [organizations, setOrganizations] = useState<Organization[]>([]) // Stores organizations
  const [networks, setNetworks] = useState<Network[]>([]) // Stores networks

  // UI and Connection State
  const [isConnected, setIsConnected] = useState(false) // Tracks connection status to Meraki
  const [isLoading, setIsLoading] = useState(false) // True when an API call is in progress

  // Filtering State
  const [selectedOrg, setSelectedOrg] = useState<string>("all") // Selected organization for filtering
  const [selectedNetwork, setSelectedNetwork] = useState<string>("all") // Selected network for filtering
  const [selectedSeverity, setSelectedSeverity] = useState<string>("all") // Selected severity for filtering
  const [searchTerm, setSearchTerm] = useState("") // Search term for filtering alerts

  // Modal/Dialog State
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null) // Alert selected for viewing details
  const [showApiKeyDialog, setShowApiKeyDialog] = useState(false) // Controls visibility of API key dialog

  // API Key State
  const [apiKey, setApiKey] = useState<string>("") // Stores the current Meraki API key
  const [tempApiKey, setTempApiKey] = useState<string>("") // Temporarily stores API key input from the dialog

  // Auto-Refresh State
  const [autoRefresh, setAutoRefresh] = useState(false) // True if auto-refresh is enabled
  const [refreshInterval, setRefreshInterval] = useState<NodeJS.Timeout | null>(null) // Stores interval ID for auto-refresh
  const [lastAlertCount, setLastAlertCount] = useState(0) // Used to detect new alerts for sound notification

  // Effect to load API key from localStorage on component mount.
  // This allows the API key to persist across browser sessions.
  useEffect(() => {
    // Security Note: Storing API keys in localStorage can be a security risk (XSS).
    // For production, a backend proxy or more secure storage is recommended.
    const storedApiKey = localStorage.getItem("merakiApiKey")
    if (storedApiKey) {
      setApiKey(storedApiKey)
      setTempApiKey(storedApiKey) // Pre-fill for "Change API Key" dialog
      toast({
        title: "API Key Cargada",
        description: "API Key cargada desde el almacenamiento local.",
      })
      // Optionally, trigger connectToMeraki() here if auto-connect is desired
      // For now, user needs to click "Conectar"
    }
  }, []) // Empty dependency array ensures this runs only once on mount

  /**
   * Handles the connection to the Meraki "API".
   * Fetches initial organizations, networks, and alerts.
   */
  const connectToMeraki = useCallback(async () => {
    if (!apiKey) {
      setShowApiKeyDialog(true) // Prompt for API key if not already set
      return
    }
    setIsLoading(true)
    try {
      const data = await connectAndFetchInitialData(apiKey)
      setOrganizations(data.organizations)
      setNetworks(data.networks)
      setAlerts(data.alerts)
      setIsConnected(true)
      toast({
        title: "Conexión exitosa",
        description: `Conectado a Meraki Dashboard. Cargadas ${data.organizations.length} organizaciones y ${data.alerts.length} alertas.`,
      })
    } catch (error) {
      toast({
        title: "Error de conexión",
        description: error instanceof Error ? error.message : "No se pudo conectar a Meraki API",
        variant: "destructive",
      })
      setIsConnected(false) // Ensure isConnected is false on any error
    } finally {
      setIsLoading(false)
    }
  }, [apiKey])

  /**
   * Handles disconnection from Meraki.
   * Clears local state, stops auto-refresh, and removes API key from localStorage.
   */
  const disconnectFromMeraki = useCallback(() => {
    setIsConnected(false)
    localStorage.removeItem("merakiApiKey") // Remove API key from persistent storage
    setAlerts([])
    setOrganizations([])
    setNetworks([])
    setSelectedOrg("all")
    setSelectedNetwork("all")
    setSelectedSeverity("all")
    setSearchTerm("")
    stopAutoRefresh()
    setLastAlertCount(0)
    toast({ title: "Desconectado", description: "Se ha desconectado de Meraki Dashboard y la API Key ha sido eliminada del almacenamiento local." })
  }, [stopAutoRefresh])

  /**
   * Opens the API key dialog, pre-filling it with the current key.
   */
  const changeApiKey = () => {
    setTempApiKey(apiKey)
    setShowApiKeyDialog(true)
  }

  /**
   * Fetches the latest alerts from the Meraki "API".
   * Prepends new alerts to the existing list.
   */
  const refreshAlerts = useCallback(async () => {
    if (!isConnected || !apiKey) { // Do not attempt refresh if not connected or no API key
      toast({ title: "No conectado", description: "Debe estar conectado para actualizar las alertas.", variant: "destructive"})
      return;
    }
    setIsLoading(true)
    try {
      const newAlerts = await fetchLatestAlerts(apiKey)
      setAlerts((prev) => [...newAlerts, ...prev]) // Prepend new alerts
      if (newAlerts.length > 0) {
        toast({ title: "Alertas actualizadas", description: `Se han cargado ${newAlerts.length} nueva(s) alerta(s).` })
      } else {
        toast({ title: "Sin nuevas alertas", description: "No hay nuevas alertas en este momento."})
      }
    } catch (error) {
      toast({ title: "Error al actualizar", description: error instanceof Error ? error.message : "No se pudieron actualizar las alertas", variant: "destructive" })
    } finally {
      setIsLoading(false)
    }
  }, [apiKey, isConnected])

  /**
   * Exports the currently filtered alerts to a CSV file.
   */
  const exportAlerts = () => {
    try {
      // Format data for CSV
      const excelData = filteredAlerts.map((alert, index) => ({
        "No.": index + 1, "ID Alerta": alert.id, Severidad: alert.severity.toUpperCase(), Tipo: alert.type.replace("_", " ").replace(/\b\w/g, (l) => l.toUpperCase()), Mensaje: alert.message, Red: alert.networkName, "ID Red": alert.networkId, Dispositivo: alert.deviceSerial, Estado: alert.status.toUpperCase(), Fecha: new Date(alert.timestamp).toLocaleDateString(), Hora: new Date(alert.timestamp).toLocaleTimeString(), Timestamp: alert.timestamp,
      }))
      const headers = Object.keys(excelData[0] || {})
      const csvContent = [headers.join(","), ...excelData.map((row) => headers.map((header) => { const value = row[header as keyof typeof row]; return typeof value === "string" && (value.includes(",") || value.includes('"')) ? `"${value.replace(/"/g, '""')}"` : value }).join(",")),].join("\n")
      const BOM = "\uFEFF"
      const blob = new Blob([BOM + csvContent], { type: "text/csv;charset=utf-8", })
      const now = new Date(); const dateStr = now.toISOString().split("T")[0]; const timeStr = now.toTimeString().split(" ")[0].replace(/:/g, "-"); const filename = `meraki_alertas_${dateStr}_${timeStr}.csv`
      const url = window.URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = filename; link.style.display = "none"; document.body.appendChild(link); link.click(); document.body.removeChild(link); window.URL.revokeObjectURL(url)
      toast({ title: "Exportación exitosa", description: `Alertas exportadas a ${filename}.` })
    } catch (error) {
      toast({ title: "Error en exportación", description: "No se pudo exportar el archivo.", variant: "destructive" })
    }
  }

  /**
   * Clears all alerts from the state.
   */
  const clearAlerts = () => {
    setAlerts([])
    toast({ title: "Alertas limpiadas", description: "Todas las alertas han sido eliminadas." })
  }

  /**
   * Handles the submission of a new or updated API key from the dialog.
   * Validates the key, updates state, and stores it in localStorage.
   */
  const handleApiKeySubmit = () => {
    if (tempApiKey.length < 20) { // Basic validation
      toast({ title: "Error", description: "API Key debe tener al menos 20 caracteres.", variant: "destructive" })
      return
    }
    setApiKey(tempApiKey)
    // Store in localStorage
    // NOTE: Storing API keys in localStorage has security implications.
    localStorage.setItem("merakiApiKey", tempApiKey)
    setShowApiKeyDialog(false)
    toast({ title: "API Key actualizada", description: "Tu API Key ha sido actualizada y guardada localmente." })
    // connectToMeraki(); // Optional: Automatically attempt to connect after updating the key.
  }

  /**
   * Plays a simple sound notification using the Web Audio API.
   * Used to indicate new alerts when auto-refresh is on.
   */
  const playAlertSound = useCallback(() => {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain()
    oscillator.connect(gainNode)
    gainNode.connect(audioContext.destination)

    // Define sound properties (frequency, duration, volume)
    oscillator.frequency.setValueAtTime(800, audioContext.currentTime) // Start frequency
    oscillator.frequency.setValueAtTime(600, audioContext.currentTime + 0.1) // Change frequency
    oscillator.frequency.setValueAtTime(800, audioContext.currentTime + 0.2) // Back to start

    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime) // Start volume
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3) // Fade out

    oscillator.start(audioContext.currentTime)
    oscillator.stop(audioContext.currentTime + 0.3) // Stop after 0.3 seconds
  }, [])

  /**
   * Stops the auto-refresh interval.
   */
  const stopAutoRefresh = useCallback(() => {
    if (refreshInterval) {
      clearInterval(refreshInterval)
      setRefreshInterval(null)
    }
    setAutoRefresh(false)
  }, [refreshInterval])

  /**
   * Starts the auto-refresh interval to fetch alerts periodically.
   */
  const startAutoRefresh = useCallback(() => {
    stopAutoRefresh() // Clear any existing interval first
    const interval = setInterval(() => {
      if (isConnected && !isLoading && apiKey) { // Check conditions before refreshing
        refreshAlerts()
      }
    }, 10000) // Refresh every 10 seconds
    setRefreshInterval(interval)
    setAutoRefresh(true)
  }, [isConnected, isLoading, refreshAlerts, stopAutoRefresh, apiKey])


  // Effect to play a sound when new alerts are detected (and not currently loading).
  useEffect(() => {
    // This effect relies on `lastAlertCount` to determine if new alerts have arrived.
    // Sound is played only if not in an `isLoading` state (e.g., initial connection).
    if (alerts.length > lastAlertCount && lastAlertCount > 0 && isConnected && !isLoading) {
      playAlertSound();
    }
    setLastAlertCount(alerts.length) // Update lastAlertCount after checking
  }, [alerts.length, playAlertSound, isConnected, lastAlertCount, isLoading])

  // Effect to clean up the auto-refresh interval when the component unmounts.
  useEffect(() => {
    return () => {
      stopAutoRefresh()
    }
  }, [stopAutoRefresh])

  // Helper functions for rendering severity icons and badges, passed to child components.
  /**
   * Returns a JSX element for the severity icon based on the alert's severity.
   * @param severity - The severity level ("critical", "warning", "info").
   * @returns A Lucide icon component.
   */
  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case "critical": return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case "warning": return <Info className="h-4 w-4 text-yellow-500" />;
      case "info": return <CheckCircle className="h-4 w-4 text-blue-500" />;
      default: return <Info className="h-4 w-4" />;
    }
  }

  /**
   * Returns a Badge component styled according to the alert's severity.
   * @param severity - The severity level ("critical", "warning", "info").
   * @returns A Badge component.
   */
  const getSeverityBadge = (severity: string) => {
    const variants = { critical: "destructive", warning: "default", info: "secondary" } as const;
    return <Badge variant={variants[severity as keyof typeof variants] || "default"}>{severity.toUpperCase()}</Badge>;
  }

  // Memoized filtered alerts based on current search and filter criteria.
  const filteredAlerts = alerts.filter((alert) => {
    const matchesSearch =
      alert.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
      alert.networkName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      alert.deviceSerial.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesOrg = selectedOrg === "all" ||
      organizations.find(o => o.name === selectedOrg && alert.networkName.includes(o.name));
    const matchesNetwork = selectedNetwork === "all" || alert.networkId === selectedNetwork;
    const matchesSeverity = selectedSeverity === "all" || alert.severity === selectedSeverity;

    return matchesSearch && matchesOrg && matchesNetwork && matchesSeverity;
  })

  // Memoized statistics for alerts (critical, warning, info, total).
  const alertStats = {
    critical: alerts.filter((a) => a.severity === "critical").length,
    warning: alerts.filter((a) => a.severity === "warning").length,
    info: alerts.filter((a) => a.severity === "info").length,
    total: alerts.length,
  }

  /**
   * Sets the selected alert to be displayed in the details dialog.
   * @param alert - The alert object to display.
   */
  const handleViewDetails = (alert: Alert) => {
    setSelectedAlert(alert)
  }

  /**
   * Opens the API key dialog when the connect button in the AlertsTable (empty state) is clicked.
   */
  const handleTableConnectClick = () => {
    setShowApiKeyDialog(true);
  }


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
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <div className={`absolute -top-1 -right-1 w-4 h-4 ${isConnected ? 'bg-green-500' : 'bg-red-500'} rounded-full border-2 border-white ${isConnected ? 'animate-pulse' : ''}`}></div>
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

        <ControlPanel
          isConnected={isConnected}
          isLoading={isLoading}
          connectToMeraki={connectToMeraki}
          disconnectFromMeraki={disconnectFromMeraki}
          changeApiKey={changeApiKey}
          refreshAlerts={refreshAlerts}
          autoRefresh={autoRefresh}
          startAutoRefresh={startAutoRefresh}
          stopAutoRefresh={stopAutoRefresh}
          exportAlerts={exportAlerts}
          clearAlerts={clearAlerts}
          alertsLength={alerts.length}
        />

        {isConnected && <StatsCards alertStats={alertStats} />}

        {isConnected && (
          <AlertFilters
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            selectedOrg={selectedOrg}
            setSelectedOrg={setSelectedOrg}
            organizations={organizations}
            selectedNetwork={selectedNetwork}
            setSelectedNetwork={setSelectedNetwork}
            networks={networks.filter(n => selectedOrg === 'all' || organizations.find(o => o.name === selectedOrg && n.organizationId === o.id))} // Pass filtered networks or all
            selectedSeverity={selectedSeverity}
            setSelectedSeverity={setSelectedSeverity}
          />
        )}

        <AlertsTable
          isConnected={isConnected}
          filteredAlerts={filteredAlerts}
          alertsCount={alerts.length}
          getSeverityIcon={getSeverityIcon}
          getSeverityBadge={getSeverityBadge}
          onViewDetails={handleViewDetails}
          onConnectClick={handleTableConnectClick}
        />

        <ApiKeyDialog
          showApiKeyDialog={showApiKeyDialog}
          setShowApiKeyDialog={setShowApiKeyDialog}
          tempApiKey={tempApiKey}
          setTempApiKey={setTempApiKey}
          handleApiKeySubmit={handleApiKeySubmit}
          apiKey={apiKey}
        />

        {/* Alert Details Dialog (remains in page.tsx as it uses selectedAlert state) */}
        {selectedAlert && (
          <Dialog open={selectedAlert !== null} onOpenChange={() => setSelectedAlert(null)}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Detalles de la Alerta</DialogTitle>
                <DialogDescription>Información completa de la alerta seleccionada</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="text-sm font-medium">ID de Alerta</label><p className="text-sm text-muted-foreground">{selectedAlert.id}</p></div>
                  <div><label className="text-sm font-medium">Tipo</label><p className="text-sm text-muted-foreground">{selectedAlert.type.replace("_", " ").replace(/\b\w/g, (l) => l.toUpperCase())}</p></div>
                  <div><label className="text-sm font-medium">Severidad</label><div className="flex items-center gap-2 mt-1">{getSeverityIcon(selectedAlert.severity)}{getSeverityBadge(selectedAlert.severity)}</div></div>
                  <div><label className="text-sm font-medium">Estado</label><p className="text-sm text-muted-foreground">{selectedAlert.status.toUpperCase()}</p></div>
                </div>
                <div><label className="text-sm font-medium">Mensaje</label><p className="text-sm text-muted-foreground">{selectedAlert.message}</p></div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="text-sm font-medium">Red</label><p className="text-sm text-muted-foreground">{selectedAlert.networkName}</p></div>
                  <div><label className="text-sm font-medium">Dispositivo</label><p className="text-sm text-muted-foreground font-mono">{selectedAlert.deviceSerial}</p></div>
                </div>
                <div><label className="text-sm font-medium">Fecha y Hora</label><p className="text-sm text-muted-foreground">{new Date(selectedAlert.timestamp).toLocaleString()}</p></div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </div>
  )
}
