"use server"

const MERAKI_API_BASE = "https://api.meraki.com/api/v1"

interface MerakiOrganization {
  id: string
  name: string
  url: string
  api: {
    enabled: boolean
  }
}

interface MerakiNetwork {
  id: string
  organizationId: string
  name: string
  productTypes: string[]
  timeZone: string
  tags: string[]
}

interface MerakiAlert {
  id: string
  type: string
  message: string
  timestamp: string
  networkId: string
  networkName: string
  deviceSerial?: string
  deviceName?: string
  severity: "critical" | "warning" | "info"
  status: "active" | "acknowledged" | "resolved"
}

export async function validateApiKey(apiKey: string) {
  try {
    const response = await fetch(`${MERAKI_API_BASE}/organizations`, {
      headers: {
        "X-Cisco-Meraki-API-Key": apiKey,
        "Content-Type": "application/json",
      },
    })

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error("API Key inválida o sin permisos")
      }
      if (response.status === 403) {
        throw new Error("API Key sin permisos suficientes")
      }
      throw new Error(`Error de API: ${response.status}`)
    }

    const organizations = await response.json()
    return {
      success: true,
      organizations: organizations as MerakiOrganization[],
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error desconocido",
    }
  }
}

export async function getOrganizations(apiKey: string) {
  try {
    const response = await fetch(`${MERAKI_API_BASE}/organizations`, {
      headers: {
        "X-Cisco-Meraki-API-Key": apiKey,
        "Content-Type": "application/json",
      },
    })

    if (!response.ok) {
      throw new Error(`Error al obtener organizaciones: ${response.status}`)
    }

    const organizations = await response.json()
    return {
      success: true,
      data: organizations as MerakiOrganization[],
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error desconocido",
    }
  }
}

export async function getNetworks(apiKey: string, organizationId: string) {
  try {
    const response = await fetch(`${MERAKI_API_BASE}/organizations/${organizationId}/networks`, {
      headers: {
        "X-Cisco-Meraki-API-Key": apiKey,
        "Content-Type": "application/json",
      },
    })

    if (!response.ok) {
      throw new Error(`Error al obtener redes: ${response.status}`)
    }

    const networks = await response.json()
    return {
      success: true,
      data: networks as MerakiNetwork[],
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error desconocido",
    }
  }
}

export async function getAlerts(apiKey: string, organizationId: string, timespan = 7776000) {
  try {
    console.log(`Obteniendo alertas para organización ${organizationId} con timespan ${timespan}`)

    // Primero intentamos obtener alertas de la organización
    const response = await fetch(
      `${MERAKI_API_BASE}/organizations/${organizationId}/alerts/history?timespan=${timespan}`,
      {
        headers: {
          "X-Cisco-Meraki-API-Key": apiKey,
          "Content-Type": "application/json",
        },
      },
    )

    console.log(`Respuesta de alertas: ${response.status}`)

    if (!response.ok) {
      // Si no funciona el endpoint de organización, intentamos con redes individuales
      console.log("Endpoint de organización falló, intentando con redes individuales...")
      return await getAlertsFromNetworks(apiKey, organizationId, timespan)
    }

    const alertsData = await response.json()
    console.log(`Alertas obtenidas: ${alertsData.length}`)

    // Transformar los datos de Meraki al formato de nuestra aplicación
    const alerts: MerakiAlert[] = alertsData.map((alert: any, index: number) => ({
      id: alert.id || alert.alertId || `alert_${organizationId}_${index}`,
      type: alert.type || alert.alertType || "unknown",
      message: alert.message || alert.details || alert.description || "Sin mensaje",
      timestamp: alert.occurredAt || alert.timestamp || alert.time || new Date().toISOString(),
      networkId: alert.networkId || alert.network?.id || "",
      networkName: alert.networkName || alert.network?.name || "Red desconocida",
      deviceSerial: alert.deviceSerial || alert.device?.serial || alert.serial || "",
      deviceName: alert.deviceName || alert.device?.name || alert.name || "",
      severity: mapSeverity(alert.type || alert.alertType, alert.category || alert.severity),
      status: alert.dismissed || alert.resolved ? "resolved" : "active",
    }))

    return {
      success: true,
      data: alerts,
    }
  } catch (error) {
    console.error("Error obteniendo alertas:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error desconocido",
    }
  }
}

export async function getAlertsFromNetworks(apiKey: string, organizationId: string, timespan = 7776000) {
  try {
    // Primero obtenemos las redes de la organización
    const networksResult = await getNetworks(apiKey, organizationId)
    if (!networksResult.success) {
      throw new Error("No se pudieron obtener las redes")
    }

    const allAlerts: MerakiAlert[] = []

    // Obtenemos alertas de cada red
    for (const network of networksResult.data) {
      try {
        const response = await fetch(`${MERAKI_API_BASE}/networks/${network.id}/alerts/history?timespan=${timespan}`, {
          headers: {
            "X-Cisco-Meraki-API-Key": apiKey,
            "Content-Type": "application/json",
          },
        })

        if (response.ok) {
          const alertsData = await response.json()
          console.log(`Alertas de red ${network.name}: ${alertsData.length}`)

          const networkAlerts: MerakiAlert[] = alertsData.map((alert: any, index: number) => ({
            id: alert.id || alert.alertId || `alert_${network.id}_${index}`,
            type: alert.type || alert.alertType || "unknown",
            message: alert.message || alert.details || alert.description || "Sin mensaje",
            timestamp: alert.occurredAt || alert.timestamp || alert.time || new Date().toISOString(),
            networkId: network.id,
            networkName: network.name,
            deviceSerial: alert.deviceSerial || alert.device?.serial || alert.serial || "",
            deviceName: alert.deviceName || alert.device?.name || alert.name || "",
            severity: mapSeverity(alert.type || alert.alertType, alert.category || alert.severity),
            status: alert.dismissed || alert.resolved ? "resolved" : "active",
          }))

          allAlerts.push(...networkAlerts)
        }
      } catch (networkError) {
        console.error(`Error obteniendo alertas de red ${network.name}:`, networkError)
      }
    }

    return {
      success: true,
      data: allAlerts,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error desconocido",
    }
  }
}

export async function getNetworkAlerts(apiKey: string, networkId: string, timespan = 7776000) {
  try {
    const response = await fetch(`${MERAKI_API_BASE}/networks/${networkId}/alerts/history?timespan=${timespan}`, {
      headers: {
        "X-Cisco-Meraki-API-Key": apiKey,
        "Content-Type": "application/json",
      },
    })

    if (!response.ok) {
      throw new Error(`Error al obtener alertas de red: ${response.status}`)
    }

    const alertsData = await response.json()

    const alerts: MerakiAlert[] = alertsData.map((alert: any, index: number) => ({
      id: alert.id || alert.alertId || `alert_${networkId}_${index}`,
      type: alert.type || alert.alertType || "unknown",
      message: alert.message || alert.details || alert.description || "Sin mensaje",
      timestamp: alert.occurredAt || alert.timestamp || alert.time || new Date().toISOString(),
      networkId: networkId,
      networkName: alert.networkName || "Red desconocida",
      deviceSerial: alert.deviceSerial || alert.device?.serial || alert.serial || "",
      deviceName: alert.deviceName || alert.device?.name || alert.name || "",
      severity: mapSeverity(alert.type || alert.alertType, alert.category || alert.severity),
      status: alert.dismissed || alert.resolved ? "resolved" : "active",
    }))

    return {
      success: true,
      data: alerts,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error desconocido",
    }
  }
}

export async function getAllHistoryAlerts(apiKey: string, organizationId: string) {
  try {
    // Meraki permite máximo 90 días en una sola consulta
    const maxTimespan = 7776000 // 90 días
    const allAlerts: MerakiAlert[] = []

    // Obtener alertas de los últimos 90 días
    let currentDate = new Date()
    let endDate = new Date(currentDate.getTime() - maxTimespan * 1000)

    // Hacer hasta 4 consultas para obtener ~1 año de historial
    for (let i = 0; i < 4; i++) {
      const t0 = Math.floor(endDate.getTime() / 1000)
      const t1 = Math.floor(currentDate.getTime() / 1000)

      try {
        const response = await fetch(
          `${MERAKI_API_BASE}/organizations/${organizationId}/alerts/history?t0=${t0}&t1=${t1}`,
          {
            headers: {
              "X-Cisco-Meraki-API-Key": apiKey,
              "Content-Type": "application/json",
            },
          },
        )

        if (response.ok) {
          const alertsData = await response.json()

          const alerts: MerakiAlert[] = alertsData.map((alert: any, index: number) => ({
            id: alert.id || alert.alertId || `alert_${organizationId}_${i}_${index}`,
            type: alert.type || alert.alertType || "unknown",
            message: alert.message || alert.details || alert.description || "Sin mensaje",
            timestamp: alert.occurredAt || alert.timestamp || alert.time || new Date().toISOString(),
            networkId: alert.networkId || alert.network?.id || "",
            networkName: alert.networkName || alert.network?.name || "Red desconocida",
            deviceSerial: alert.deviceSerial || alert.device?.serial || alert.serial || "",
            deviceName: alert.deviceName || alert.device?.name || alert.name || "",
            severity: mapSeverity(alert.type || alert.alertType, alert.category || alert.severity),
            status: alert.dismissed || alert.resolved ? "resolved" : "active",
          }))

          allAlerts.push(...alerts)
        } else {
          // Si falla el endpoint de organización, intentamos con redes
          const networkAlertsResult = await getAlertsFromNetworks(apiKey, organizationId, maxTimespan)
          if (networkAlertsResult.success) {
            allAlerts.push(...networkAlertsResult.data)
          }
        }
      } catch (error) {
        console.error(`Error en consulta ${i + 1}:`, error)
      }

      // Preparar para la siguiente iteración
      currentDate = new Date(endDate)
      endDate = new Date(currentDate.getTime() - maxTimespan * 1000)
    }

    return {
      success: true,
      data: allAlerts,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error desconocido",
    }
  }
}

// Función para generar alertas de prueba si no hay alertas reales
export async function generateTestAlerts(organizationId: string, networkIds: string[]): Promise<MerakiAlert[]> {
  const testAlerts: MerakiAlert[] = [
    {
      id: `test_alert_1_${organizationId}`,
      type: "gateway_down",
      severity: "critical",
      message: "Gateway MX84 desconectado - Sin conectividad a Internet",
      timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      networkId: networkIds[0] || "test_network_1",
      networkName: "Red Principal",
      deviceSerial: "Q2XX-XXXX-XXXX",
      status: "active",
    },
    {
      id: `test_alert_2_${organizationId}`,
      type: "high_cpu_usage",
      severity: "warning",
      message: "Uso alto de CPU en switch MS220-8P (85%)",
      timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
      networkId: networkIds[1] || "test_network_2",
      networkName: "Red Sucursal",
      deviceSerial: "Q2YY-YYYY-YYYY",
      status: "acknowledged",
    },
    {
      id: `test_alert_3_${organizationId}`,
      type: "client_connection_failed",
      severity: "info",
      message: "Múltiples fallos de conexión de clientes en AP MR36",
      timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
      networkId: networkIds[2] || "test_network_3",
      networkName: "Red WiFi",
      deviceSerial: "Q2ZZ-ZZZZ-ZZZZ",
      status: "resolved",
    },
    {
      id: `test_alert_4_${organizationId}`,
      type: "bandwidth_exceeded",
      severity: "warning",
      message: "Ancho de banda excedido en enlace WAN (95% utilización)",
      timestamp: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
      networkId: networkIds[0] || "test_network_1",
      networkName: "Red Principal",
      deviceSerial: "Q2AA-BBBB-CCCC",
      status: "active",
    },
    {
      id: `test_alert_5_${organizationId}`,
      type: "vpn_connectivity_change",
      severity: "critical",
      message: "Túnel VPN Site-to-Site desconectado",
      timestamp: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
      networkId: networkIds[1] || "test_network_2",
      networkName: "Red Sucursal",
      deviceSerial: "Q2DD-EEEE-FFFF",
      status: "active",
    },
  ]

  return testAlerts
}

function mapSeverity(type: string, category?: string): "critical" | "warning" | "info" {
  const criticalTypes = [
    "gateway_down",
    "switch_down",
    "ap_down",
    "device_down",
    "wan_down",
    "vpn_connectivity_change",
    "power_supply_down",
    "device_offline",
  ]

  const warningTypes = [
    "high_cpu_usage",
    "high_memory_usage",
    "bandwidth_exceeded",
    "dhcp_no_leases_remaining",
    "rogue_ap_detected",
    "power_supply_redundancy_lost",
    "high_latency",
  ]

  const lowerType = type?.toLowerCase() || ""
  const lowerCategory = category?.toLowerCase() || ""

  if (
    criticalTypes.some((t) => lowerType.includes(t)) ||
    lowerCategory.includes("critical") ||
    lowerCategory.includes("error")
  ) {
    return "critical"
  }

  if (
    warningTypes.some((t) => lowerType.includes(t)) ||
    lowerCategory.includes("warning") ||
    lowerCategory.includes("warn")
  ) {
    return "warning"
  }

  return "info"
}
