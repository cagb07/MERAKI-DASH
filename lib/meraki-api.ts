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

export async function getAlerts(apiKey: string, organizationId: string, timespan = 86400) {
  try {
    // Obtener alertas de la organización
    const response = await fetch(
      `${MERAKI_API_BASE}/organizations/${organizationId}/alerts/history?timespan=${timespan}`,
      {
        headers: {
          "X-Cisco-Meraki-API-Key": apiKey,
          "Content-Type": "application/json",
        },
      },
    )

    if (!response.ok) {
      throw new Error(`Error al obtener alertas: ${response.status}`)
    }

    const alertsData = await response.json()

    // Transformar los datos de Meraki al formato de nuestra aplicación
    const alerts: MerakiAlert[] = alertsData.map((alert: any) => ({
      id: alert.id || `alert_${Date.now()}_${Math.random()}`,
      type: alert.type || "unknown",
      message: alert.message || alert.details || "Sin mensaje",
      timestamp: alert.occurredAt || alert.timestamp || new Date().toISOString(),
      networkId: alert.networkId || "",
      networkName: alert.networkName || "Red desconocida",
      deviceSerial: alert.deviceSerial || alert.device?.serial || "",
      deviceName: alert.deviceName || alert.device?.name || "",
      severity: mapSeverity(alert.type, alert.category),
      status: alert.dismissed ? "resolved" : "active",
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

export async function getNetworkAlerts(apiKey: string, networkId: string, timespan = 86400) {
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

    const alerts: MerakiAlert[] = alertsData.map((alert: any) => ({
      id: alert.id || `alert_${Date.now()}_${Math.random()}`,
      type: alert.type || "unknown",
      message: alert.message || alert.details || "Sin mensaje",
      timestamp: alert.occurredAt || alert.timestamp || new Date().toISOString(),
      networkId: networkId,
      networkName: alert.networkName || "Red desconocida",
      deviceSerial: alert.deviceSerial || alert.device?.serial || "",
      deviceName: alert.deviceName || alert.device?.name || "",
      severity: mapSeverity(alert.type, alert.category),
      status: alert.dismissed ? "resolved" : "active",
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

function mapSeverity(type: string, category?: string): "critical" | "warning" | "info" {
  const criticalTypes = ["gateway_down", "switch_down", "ap_down", "device_down", "wan_down", "vpn_connectivity_change"]

  const warningTypes = [
    "high_cpu_usage",
    "high_memory_usage",
    "bandwidth_exceeded",
    "dhcp_no_leases_remaining",
    "rogue_ap_detected",
  ]

  const lowerType = type?.toLowerCase() || ""
  const lowerCategory = category?.toLowerCase() || ""

  if (criticalTypes.some((t) => lowerType.includes(t)) || lowerCategory.includes("critical")) {
    return "critical"
  }

  if (warningTypes.some((t) => lowerType.includes(t)) || lowerCategory.includes("warning")) {
    return "warning"
  }

  return "info"
}
