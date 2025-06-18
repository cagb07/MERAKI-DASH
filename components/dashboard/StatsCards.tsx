"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertTriangle, CheckCircle, Info, Activity } from "lucide-react"

/**
 * Interface for the statistics of alerts.
 * @property critical - Number of critical alerts.
 * @property warning - Number of warning alerts.
 * @property info - Number of informational alerts.
 * @property total - Total number of alerts.
 */
interface AlertStats {
  critical: number
  warning: number
  info: number
  total: number
}

/**
 * Props for the StatsCards component.
 * @property alertStats - An object containing the counts of alerts by severity and total.
 */
interface StatsCardsProps {
  alertStats: AlertStats
}

/**
 * StatsCards component displays a set of cards showing alert statistics.
 * It includes counts for critical, warning, informational, and total alerts,
 * along with visual representations (e.g., progress circles).
 */
export default function StatsCards({ alertStats }: StatsCardsProps) {
  return (
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
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
              <path
                className="text-red-500"
                stroke="currentColor"
                strokeWidth="3"
                fill="none"
                strokeDasharray={`${alertStats.total > 0 ? (alertStats.critical / alertStats.total) * 100 : 0}, 100`}
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
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
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
              <path
                className="text-yellow-500"
                stroke="currentColor"
                strokeWidth="3"
                fill="none"
                strokeDasharray={`${alertStats.total > 0 ? (alertStats.warning / alertStats.total) * 100 : 0}, 100`}
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
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
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
              <path
                className="text-blue-500"
                stroke="currentColor"
                strokeWidth="3"
                fill="none"
                strokeDasharray={`${alertStats.total > 0 ? (alertStats.info / alertStats.total) * 100 : 0}, 100`}
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
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
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
              {alertStats.total > 0 && (
                <>
                  <path
                    className="text-red-500"
                    stroke="currentColor"
                    strokeWidth="3"
                    fill="none"
                    strokeDasharray={`${(alertStats.critical / alertStats.total) * 100}, 100`}
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                  <path
                    className="text-yellow-500"
                    stroke="currentColor"
                    strokeWidth="3"
                    fill="none"
                    strokeDasharray={`${(alertStats.warning / alertStats.total) * 100}, 100`}
                    strokeDashoffset={`-${(alertStats.critical / alertStats.total) * 100}`}
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                  <path
                    className="text-blue-500"
                    stroke="currentColor"
                    strokeWidth="3"
                    fill="none"
                    strokeDasharray={`${(alertStats.info / alertStats.total) * 100}, 100`}
                    strokeDashoffset={`-${((alertStats.critical + alertStats.warning) / alertStats.total) * 100}`}
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
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
  )
}
