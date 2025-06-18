"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { RefreshCw, Download, Trash2, Wifi } from "lucide-react"

/**
 * Props for the ControlPanel component.
 * @property isConnected - Indicates if the application is connected to the Meraki API.
 * @property isLoading - Indicates if an API operation is currently in progress.
 * @property connectToMeraki - Function to initiate connection to Meraki.
 * @property disconnectFromMeraki - Function to disconnect from Meraki.
 * @property changeApiKey - Function to open the API key change dialog.
 * @property refreshAlerts - Function to manually refresh alerts.
 * @property autoRefresh - Boolean indicating if auto-refresh is enabled.
 * @property startAutoRefresh - Function to start auto-refreshing alerts.
 * @property stopAutoRefresh - Function to stop auto-refreshing alerts.
 * @property exportAlerts - Function to export current alerts to CSV.
 * @property clearAlerts - Function to clear all currently displayed alerts.
 * @property alertsLength - The number of current alerts, used to disable export/clear if empty.
 */
interface ControlPanelProps {
  isConnected: boolean;
  isLoading: boolean;
  connectToMeraki: () => void;
  disconnectFromMeraki: () => void;
  changeApiKey: () => void;
  refreshAlerts: () => void;
  autoRefresh: boolean;
  startAutoRefresh: () => void;
  stopAutoRefresh: () => void;
  exportAlerts: () => void;
  clearAlerts: () => void;
  alertsLength: number;
}

/**
 * ControlPanel component provides main action buttons for the dashboard.
 * This includes connecting/disconnecting, managing API keys, refreshing alerts,
 * toggling auto-refresh, exporting, and clearing alerts.
 * It also displays the current connection status.
 */
export default function ControlPanel({
  isConnected,
  isLoading,
  connectToMeraki,
  disconnectFromMeraki,
  changeApiKey,
  refreshAlerts,
  autoRefresh,
  startAutoRefresh,
  stopAutoRefresh,
  exportAlerts,
  clearAlerts,
  alertsLength,
}: ControlPanelProps) {
  return (
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
            {isLoading && !isConnected ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <Wifi className="h-4 w-4 mr-2" />}
            {isConnected ? "Reconectar" : "Conectar"}
          </Button>

          {isConnected && (
            <Button onClick={changeApiKey} variant="outline" size="sm" disabled={isLoading}>
              Cambiar API Key
            </Button>
          )}

          {isConnected && (
            <Button
              onClick={disconnectFromMeraki}
              variant="outline"
              size="sm"
              className="text-red-600 hover:text-red-700"
              disabled={isLoading}
            >
              Desconectar
            </Button>
          )}

          <Button onClick={refreshAlerts} disabled={!isConnected || isLoading} variant="outline">
            {isLoading && isConnected ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            Actualizar
          </Button>

          {isConnected && (
            <Button
              onClick={autoRefresh ? stopAutoRefresh : startAutoRefresh}
              variant={autoRefresh ? "default" : "outline"}
              className={autoRefresh ? "bg-blue-600 hover:bg-blue-700" : ""}
              disabled={isLoading}
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

          <Button onClick={exportAlerts} disabled={alertsLength === 0 || !isConnected || isLoading} variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Exportar a Excel
          </Button>

          <Button onClick={clearAlerts} variant="outline" className="text-red-600 hover:text-red-700" disabled={!isConnected || isLoading}>
            <Trash2 className="h-4 w-4 mr-2" />
            Limpiar
          </Button>

          <div className="ml-auto flex items-center gap-2">
            <Badge variant={isConnected ? "default" : "secondary"}>
              {isConnected ? (autoRefresh ? "🔴 En Vivo" : "Conectado") : "Desconectado"}
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
