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

  // Initialize with sample data
  useEffect(() => {
    const sampleAlerts: Alert[] = [
      {
        id: "alert_001",
        type: "gateway_down",
        severity: "critical",
        message: "Gateway MX84 en oficina principal desconectado",
        timestamp: new Date().toISOString(),
        networkId: "N_123456789",
        networkName: "Oficina Principal",
        deviceSerial: "Q2XX-XXXX-XXXX",
        status: "active",
      },
      {
        id: "alert_002",
        type: "high_cpu_usage",
        severity: "warning",
        message: "Uso alto de CPU en switch MS220-8P",
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        networkId: "N_987654321",
        networkName: "Sucursal Norte",
        deviceSerial: "Q2YY-YYYY-YYYY",
        status: "acknowledged",
      },
      {
        id: "alert_003",
        type: "client_connection_failed",
        severity: "info",
        message: "Múltiples fallos de conexión de clientes en AP MR36",
        timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
        networkId: "N_456789123",
        networkName: "Planta Baja",
        deviceSerial: "Q2ZZ-ZZZZ-ZZZZ",
        status: "resolved",
      },
    ]

    const sampleOrgs: Organization[] = [
      { id: "org_1", name: "Oficina Principal" },
      { id: "org_2", name: "Sucursal Norte" },
      { id: "org_3", name: "Planta Baja" },
    ]

    const sampleNetworks: Network[] = [
      { id: "N_123456789", name: "Red Principal", organizationId: "org_1" },
      { id: "N_987654321", name: "Red Sucursal", organizationId: "org_2" },
      { id: "N_456789123", name: "Red Planta Baja", organizationId: "org_3" },
    ]

    setAlerts(sampleAlerts)
    setOrganizations(sampleOrgs)
    setNetworks(sampleNetworks)
  }, [])

  const connectToMeraki = async () => {
    setIsLoading(true)
    try {
      // Simulate API connection
      await new Promise((resolve) => setTimeout(resolve, 2000))
      setIsConnected(true)
      toast({
        title: "Conexión exitosa",
        description: "Conectado a Meraki Dashboard",
      })
    } catch (error) {
      toast({
        title: "Error de conexión",
        description: "No se pudo conectar a Meraki API",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const refreshAlerts = async () => {
    setIsLoading(true)
    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1500))

      // Generate new sample alerts
      const newAlert: Alert = {
        id: `alert_${Date.now()}`,
        type: "bandwidth_exceeded",
        severity: "warning",
        message: "Ancho de banda excedido en red corporativa",
        timestamp: new Date().toISOString(),
        networkId: "N_123456789",
        networkName: "Red Corporativa",
        deviceSerial: "Q2AA-BBBB-CCCC",
        status: "active",
      }

      setAlerts((prev) => [newAlert, ...prev])
      toast({
        title: "Alertas actualizadas",
        description: "Se han cargado las últimas alertas",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudieron actualizar las alertas",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const exportAlerts = () => {
    const dataStr = JSON.stringify(filteredAlerts, null, 2)
    const dataUri = "data:application/json;charset=utf-8," + encodeURIComponent(dataStr)

    const exportFileDefaultName = `meraki_alerts_${new Date().toISOString().split("T")[0]}.json`

    const linkElement = document.createElement("a")
    linkElement.setAttribute("href", dataUri)
    linkElement.setAttribute("download", exportFileDefaultName)
    linkElement.click()

    toast({
      title: "Exportación exitosa",
      description: "Las alertas se han exportado correctamente",
    })
  }

  const clearAlerts = () => {
    setAlerts([])
    toast({
      title: "Alertas limpiadas",
      description: "Todas las alertas han sido eliminadas",
    })
  }

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

  const alertStats = {
    critical: alerts.filter((a) => a.severity === "critical").length,
    warning: alerts.filter((a) => a.severity === "warning").length,
    info: alerts.filter((a) => a.severity === "info").length,
    total: alerts.length,
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-4">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2 relative">
          <div className="absolute top-0 right-0">
            <ThemeToggle />
          </div>
          <div className="flex items-center justify-center gap-2">
            <Shield className="h-8 w-8 text-blue-600" />
            <h1 className="text-4xl font-bold text-slate-800 dark:text-slate-100">Meraki Dashboard</h1>
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

              <Button onClick={refreshAlerts} disabled={!isConnected || isLoading} variant="outline">
                <RefreshCw className="h-4 w-4 mr-2" />
                Actualizar
              </Button>

              <Button onClick={exportAlerts} disabled={alerts.length === 0} variant="outline">
                <Download className="h-4 w-4 mr-2" />
                Exportar
              </Button>

              <Button onClick={clearAlerts} variant="outline" className="text-red-600 hover:text-red-700">
                <Trash2 className="h-4 w-4 mr-2" />
                Limpiar
              </Button>

              <div className="ml-auto">
                <Badge variant={isConnected ? "default" : "secondary"}>
                  {isConnected ? "Conectado" : "Desconectado"}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Críticas</CardTitle>
              <AlertTriangle className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{alertStats.critical}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Advertencias</CardTitle>
              <Info className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{alertStats.warning}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Información</CardTitle>
              <CheckCircle className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{alertStats.info}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total</CardTitle>
              <Activity className="h-4 w-4 text-slate-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-700">{alertStats.total}</div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle>Filtros</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
            </div>
          </CardContent>
        </Card>

        {/* Alerts Table */}
        <Card>
          <CardHeader>
            <CardTitle>Alertas Activas</CardTitle>
            <CardDescription>
              Mostrando {filteredAlerts.length} de {alerts.length} alertas
            </CardDescription>
          </CardHeader>
          <CardContent>
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
                  {filteredAlerts.map((alert) => (
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
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
