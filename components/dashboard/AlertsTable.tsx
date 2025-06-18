"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogTrigger } from "@/components/ui/dialog"
import { CheckCircle, Wifi } from "lucide-react"
import React from "react"
// Assuming Alert type is imported from a central location e.g. "@/lib/meraki-api"
import type { Alert } from "@/lib/meraki-api";

/**
 * Props for the AlertsTable component.
 * @property isConnected - Boolean indicating if the application is connected to the Meraki API.
 * @property filteredAlerts - Array of alerts to display (already filtered).
 * @property alertsCount - Total number of alerts before filtering.
 * @property getSeverityIcon - Function that returns a JSX icon based on severity.
 * @property getSeverityBadge - Function that returns a JSX Badge component based on severity.
 * @property onViewDetails - Callback function triggered when "Ver Detalles" is clicked for an alert.
 * @property onConnectClick - Callback function triggered when "Conectar ahora" is clicked (in disconnected state).
 */
interface AlertsTableProps {
  isConnected: boolean;
  filteredAlerts: Alert[];
  alertsCount: number;
  getSeverityIcon: (severity: Alert['severity']) => React.ReactNode;
  getSeverityBadge: (severity: Alert['severity']) => React.ReactNode;
  onViewDetails: (alert: Alert) => void;
  onConnectClick: () => void;
}

/**
 * AlertsTable component displays a table of alerts or messages indicating
 * connection status or empty states. It allows users to view alert details.
 */
export default function AlertsTable({
  isConnected,
  filteredAlerts,
  alertsCount,
  getSeverityIcon,
  getSeverityBadge,
  onViewDetails,
  onConnectClick,
}: AlertsTableProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Alertas Activas</CardTitle>
        <CardDescription>
          Mostrando {filteredAlerts.length} de {alertsCount} alertas
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!isConnected ? (
          <div className="text-center py-8">
            <Wifi className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No conectado</h3>
            <p className="text-muted-foreground mb-4">Conecta con tu API Key de Meraki para ver las alertas</p>
            <Button onClick={onConnectClick}>
              <Wifi className="h-4 w-4 mr-2" />
              Conectar ahora
            </Button>
          </div>
        ) : filteredAlerts.length === 0 ? (
          <div className="text-center py-8">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No hay alertas</h3>
            <p className="text-muted-foreground">
              No se encontraron alertas que coincidan con los filtros actuales
            </p>
          </div>
        ) : (
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
                      {/* DialogTrigger is used here, Dialog Content remains in parent */}
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="outline" size="sm" onClick={() => onViewDetails(alert)}>
                            Ver Detalles
                          </Button>
                        </DialogTrigger>
                        {/* The actual DialogContent will be rendered in the parent component (page.tsx) */}
                      </Dialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
