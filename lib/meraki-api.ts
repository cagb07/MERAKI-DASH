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
  console.log("🔑 Validando API Key...")
  try {
    const response = await fetch(`${MERAKI_API_BASE}/organizations`, {
      headers: {
        "X-Cisco-Meraki-API-Key": apiKey,
        "Content-Type": "application/json",
      },
    })

    if (!response.ok) {
      let errorMessage = `Error de API: ${response.status} ${response.statusText}`
      if (response.status === 401) {
        errorMessage = "API Key inválida o sin permisos."
      } else if (response.status === 403) {
        errorMessage = "API Key sin permisos suficientes."
      } else if (response.status === 429) {
        errorMessage = "Meraki API rate limit exceeded. Por favor espera y reintenta."
      }
      console.error(`❌ Error en validación de API Key: ${errorMessage} (Status: ${response.status})`)
      // Throwing an error here will be caught by the catch block below,
      // which then returns the standardized error object.
      throw new Error(errorMessage)
    }

    const organizations = await response.json()
    console.log(`✅ API Key validada. Organizaciones encontradas: ${organizations.length}`)
    return {
      success: true,
      organizations: organizations as MerakiOrganization[],
    }
  } catch (error) {
    // Ensure the status is captured if it's a custom error thrown from above
    const status = error instanceof Error && (error as any).status ? (error as any).status : 0;
    console.error(`❌ Excepción en validateApiKey: ${error instanceof Error ? error.message : String(error)}`)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error desconocido durante validación de API Key.",
      status: status,
    }
  }
}

export async function getOrganizations(apiKey: string) {
  console.log("🏢 Obteniendo organizaciones...")
  try {
    const response = await fetch(`${MERAKI_API_BASE}/organizations`, {
      headers: {
        "X-Cisco-Meraki-API-Key": apiKey,
        "Content-Type": "application/json",
      },
    })

    if (!response.ok) {
      let errorMessage = `Error al obtener organizaciones: ${response.status} ${response.statusText}`
      if (response.status === 401) {
        errorMessage = "API Key inválida o sin permisos para obtener organizaciones."
      } else if (response.status === 403) {
        errorMessage = "API Key sin permisos suficientes para obtener organizaciones."
      } else if (response.status === 429) {
        errorMessage = "Meraki API rate limit exceeded al obtener organizaciones. Por favor espera y reintenta."
      }
      console.error(`❌ ${errorMessage} (Status: ${response.status})`)
      return { success: false, error: errorMessage, status: response.status }
    }

    const organizations = await response.json()
    console.log(`✅ Organizaciones obtenidas: ${organizations.length}`)
    return {
      success: true,
      data: organizations as MerakiOrganization[],
    }
  } catch (error) {
    console.error(`❌ Excepción en getOrganizations: ${error instanceof Error ? error.message : String(error)}`)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error desconocido al obtener organizaciones.",
      status: 0, // General exception, no HTTP status
    }
  }
}

export async function getNetworks(apiKey: string, organizationId: string) {
  console.log(`🌐 Obteniendo redes para la organización: ${organizationId}...`)
  try {
    const response = await fetch(`${MERAKI_API_BASE}/organizations/${organizationId}/networks`, {
      headers: {
        "X-Cisco-Meraki-API-Key": apiKey,
        "Content-Type": "application/json",
      },
    })

    if (!response.ok) {
      let errorMessage = `Error al obtener redes para la organización ${organizationId}: ${response.status} ${response.statusText}`
      if (response.status === 401) {
        errorMessage = `API Key inválida o sin permisos para obtener redes de la org ${organizationId}.`
      } else if (response.status === 403) {
        errorMessage = `API Key sin permisos suficientes para obtener redes de la org ${organizationId}.`
      } else if (response.status === 404) {
        errorMessage = `Organización ${organizationId} no encontrada al obtener redes.`
      } else if (response.status === 429) {
        errorMessage = `Meraki API rate limit exceeded al obtener redes para la org ${organizationId}. Por favor espera y reintenta.`
      }
      console.error(`❌ ${errorMessage} (Status: ${response.status})`)
      return { success: false, error: errorMessage, status: response.status }
    }

    const networks = await response.json()
    console.log(`✅ Redes obtenidas para la organización ${organizationId}: ${networks.length}`)
    return {
      success: true,
      data: networks as MerakiNetwork[],
    }
  } catch (error) {
    console.error(`❌ Excepción en getNetworks para la org ${organizationId}: ${error instanceof Error ? error.message : String(error)}`)
    return {
      success: false,
      error: error instanceof Error ? error.message : `Error desconocido al obtener redes para la org ${organizationId}.`,
      status: 0, // General exception
    }
  }
}

export async function getAlerts(
  apiKey: string,
  organizationId: string,
  timespan?: number, // Make timespan optional
  t0?: string, // Add t0
  t1?: string, // Add t1
) {
  try {
    let url = `${MERAKI_API_BASE}/organizations/${organizationId}/alerts/history`
    let queryParams = ""
    let logParams = ""

    if (t0 && t1) {
      queryParams = `t0=${t0}&t1=${t1}`
      logParams = `t0=${t0}, t1=${t1}`
    } else if (timespan) {
      queryParams = `timespan=${timespan}`
      logParams = `timespan ${timespan}s`
    } else {
      const defaultTimespan = 7776000 // Default to 90 days
      queryParams = `timespan=${defaultTimespan}`
      logParams = `timespan por defecto ${defaultTimespan}s`
    }
    console.log(`🚨 Obteniendo alertas para organización ${organizationId} con ${logParams}...`)

    // Primero intentamos obtener alertas de la organización
    const response = await fetch(`${url}?${queryParams}`, {
      headers: {
        "X-Cisco-Meraki-API-Key": apiKey,
        "Content-Type": "application/json",
      },
    })

    console.log(`[Org: ${organizationId}] Respuesta de API para alertas: ${response.status}`)

    if (!response.ok) {
      let errorMessage = `Error al obtener alertas para la organización ${organizationId}: ${response.status} ${response.statusText}`
      if (response.status === 401) {
        errorMessage = `API Key inválida o sin permisos para obtener alertas de la org ${organizationId}.`
        console.error(`❌ ${errorMessage} (Status: ${response.status})`)
        return { success: false, error: errorMessage, status: response.status } // Do not fallback on 401
      } else if (response.status === 403) {
        errorMessage = `API Key sin permisos suficientes para obtener alertas de la org ${organizationId}.`
        console.error(`❌ ${errorMessage} (Status: ${response.status})`)
        return { success: false, error: errorMessage, status: response.status } // Do not fallback on 403
      } else if (response.status === 404) {
        errorMessage = `Endpoint de alertas de organización no encontrado para ${organizationId}. Intentando fallback a redes...`
      } else if (response.status === 429) {
        errorMessage = `Meraki API rate limit exceeded al obtener alertas para la org ${organizationId}. Intentando fallback a redes...`
      }

      console.warn(`🔶 ${errorMessage} (Status: ${response.status}). Procediendo con fallback a getAlertsFromNetworks.`)
      const fallbackResult = await getAlertsFromNetworks(apiKey, organizationId, timespan, t0, t1);
      // Ensure the structure from fallbackResult is preserved, and add usedNetworkFallback
      if (fallbackResult.success) {
        return { ...fallbackResult, usedNetworkFallback: true };
      }
      // If fallbackResult is not success, it already has { success: false, error: ..., status: ... }
      return { ...fallbackResult, usedNetworkFallback: true }; // still indicate fallback was attempted.
    }

    const alertsData = await response.json()
    console.log(`✅ Alertas obtenidas para la organización ${organizationId}: ${alertsData.length}`)

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
      usedNetworkFallback: false,
    }
  } catch (error) {
    console.error(`❌ Excepción en getAlerts para la org ${organizationId}: ${error instanceof Error ? error.message : String(error)}`)
    return {
      success: false,
      error: error instanceof Error ? error.message : `Error desconocido al obtener alertas para la org ${organizationId}.`,
      status: 0, // General exception
    }
  }
}

export async function getAlertsFromNetworks(
  apiKey: string,
  organizationId: string,
  timespan?: number,
  t0?: string,
  t1?: string,
) {
  try {
    console.log(`Fallback: Obteniendo alertas por red para la organización ${organizationId}...`)
    // Primero obtenemos las redes de la organización
    const networksResult = await getNetworks(apiKey, organizationId)
    if (!networksResult.success) {
      // If getNetworks fails, it already returns a standardized error object with status
      console.error(`❌ Fallo al obtener redes en getAlertsFromNetworks para la org ${organizationId}: ${networksResult.error}`)
      return {
        success: false,
        error: `No se pudieron obtener las redes para la org ${organizationId} durante el fallback de alertas: ${networksResult.error}`,
        status: networksResult.status
      };
    }
    if (networksResult.data.length === 0) {
      console.warn(`🔶 No se encontraron redes para la org ${organizationId} en getAlertsFromNetworks.`)
      return { success: true, data: [] } // No networks, so no alerts from them.
    }

    const allAlerts: MerakiAlert[] = []
    let successfulNetworkFetches = 0;

    // Obtenemos alertas de cada red
    for (const network of networksResult.data) {
      await new Promise(resolve => setTimeout(resolve, 200)); // Delay

      try {
        let networkAlertsUrl = `${MERAKI_API_BASE}/networks/${network.id}/alerts/history`
        let networkQueryParams = ""
        let netLogParams = ""

        if (t0 && t1) {
          networkQueryParams = `t0=${t0}&t1=${t1}`
          netLogParams = `t0=${t0}, t1=${t1}`
        } else if (timespan) {
          networkQueryParams = `timespan=${timespan}`
          netLogParams = `timespan ${timespan}s`
        } else {
          const defaultNetworkTimespan = 7776000;
          networkQueryParams = `timespan=${defaultNetworkTimespan}`
          netLogParams = `timespan por defecto ${defaultNetworkTimespan}s`
        }
        console.log(`[Network ID: ${network.id}, Name: ${network.name}] Obteniendo alertas con ${netLogParams}`)

        const response = await fetch(`${networkAlertsUrl}?${networkQueryParams}`, {
          headers: { "X-Cisco-Meraki-API-Key": apiKey, "Content-Type": "application/json" },
        })

        if (response.ok) {
          const alertsData = await response.json()
          console.log(`[Network ID: ${network.id}] Alertas obtenidas: ${alertsData.length}`)
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
          successfulNetworkFetches++;
        } else {
          let netErrorMessage = `Error al obtener alertas para Network ID ${network.id}: ${response.status} ${response.statusText}`
          if (response.status === 429) {
            netErrorMessage = `Meraki API rate limit exceeded para Network ID ${network.id}.`
          }
          console.error(`❌ ${netErrorMessage} (Status: ${response.status})`)
          // Continue to next network
        }
      } catch (networkFetchError) {
        console.error(
          `❌ Excepción obteniendo alertas para Network ID ${network.id}:`,
          networkFetchError instanceof Error ? networkFetchError.message : String(networkFetchError),
        )
        // Continue to next network
      }
    }

    console.log(`✅ Finalizado getAlertsFromNetworks para org ${organizationId}. ${successfulNetworkFetches}/${networksResult.data.length} redes consultadas exitosamente. Total alertas: ${allAlerts.length}`)
    return {
      success: true,
      data: allAlerts,
      // Note: We return success:true even if some networks fail, as partial data is better than none.
      // The caller might want to check if allAlerts.length > 0 or compare with total networks.
    }
  } catch (error) { // This outer catch is for errors like the initial getNetworks failing.
    console.error(`❌ Excepción mayor en getAlertsFromNetworks para la org ${organizationId}: ${error instanceof Error ? error.message : String(error)}`)
    return {
      success: false,
      error: error instanceof Error ? error.message : `Error desconocido en fallback de alertas para la org ${organizationId}.`,
      status: 0, // General exception
    }
  }
}

export async function getNetworkAlerts(apiKey: string, networkId: string, timespanInSeconds = 7776000) {
  console.log(`ನೆಟ್‌ವರ್ಕ್ ${networkId} ಗಾಗಿ ಎಚ್ಚರಿಕೆಗಳನ್ನು ಪಡೆಯಲಾಗುತ್ತಿದೆ timespan ${timespanInSeconds}s...`) // Obteniendo alertas para la red X con timespan Ys...
  try {
    const response = await fetch(`${MERAKI_API_BASE}/networks/${networkId}/alerts/history?timespan=${timespanInSeconds}`, {
      headers: {
        "X-Cisco-Meraki-API-Key": apiKey,
        "Content-Type": "application/json",
      },
    })

    if (!response.ok) {
      let errorMessage = `Error al obtener alertas para la red ${networkId}: ${response.status} ${response.statusText}`
      if (response.status === 401) {
        errorMessage = `API Key inválida o sin permisos para obtener alertas de la red ${networkId}.`
      } else if (response.status === 403) {
        errorMessage = `API Key sin permisos suficientes para obtener alertas de la red ${networkId}.`
      } else if (response.status === 404) {
        errorMessage = `Red ${networkId} no encontrada al obtener alertas.`
      } else if (response.status === 429) {
        errorMessage = `Meraki API rate limit exceeded al obtener alertas para la red ${networkId}. Por favor espera y reintenta.`
      }
      console.error(`❌ ${errorMessage} (Status: ${response.status})`)
      return { success: false, error: errorMessage, status: response.status }
    }

    const alertsData = await response.json()
    console.log(`✅ Alertas obtenidas para la red ${networkId}: ${alertsData.length}`)

    const alerts: MerakiAlert[] = alertsData.map((alert: any, index: number) => ({
      id: alert.id || alert.alertId || `alert_${networkId}_${index}`,
      type: alert.type || alert.alertType || "unknown",
      message: alert.message || alert.details || alert.description || "Sin mensaje",
      timestamp: alert.occurredAt || alert.timestamp || alert.time || new Date().toISOString(),
      networkId: networkId,
      networkName: alert.networkName || "Red desconocida", // Attempt to use if provided by API
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
    console.error(`❌ Excepción en getNetworkAlerts para la red ${networkId}: ${error instanceof Error ? error.message : String(error)}`)
    return {
      success: false,
      error: error instanceof Error ? error.message : `Error desconocido al obtener alertas para la red ${networkId}.`,
      status: 0, // General exception
    }
  }
}

export async function getAllHistoryAlerts(apiKey: string, organizationId: string) {
  try {
    console.log(`📜 Obteniendo historial completo de alertas para la organización ${organizationId}...`)
    // Meraki permite máximo 90 días en una sola consulta
    const MAX_TIMESPAN_SECONDS = 7776000 // 90 días
    const allAlerts: MerakiAlert[] = []
    let totalSuccessfulChunks = 0;

    // Obtener alertas en chunks de 90 días, hasta ~1 año (4 chunks)
    let currentEndDate = new Date() // Start from now for the most recent chunk

    for (let i = 0; i < 4; i++) {
      const t1ISO = currentEndDate.toISOString()
      const currentStartDate = new Date(currentEndDate.getTime() - MAX_TIMESPAN_SECONDS * 1000)
      const t0ISO = currentStartDate.toISOString()

      console.log(`📜 [Chunk ${i+1}/4] Obteniendo historial de alertas para org ${organizationId} desde ${t0ISO} hasta ${t1ISO}`)
      try {
        const alertsResult = await getAlerts(apiKey, organizationId, undefined, t0ISO, t1ISO)

        if (alertsResult.success && alertsResult.data) {
          console.log(`📜 [Chunk ${i+1}/4] Exitoso. ${alertsResult.data.length} alertas obtenidas.`)
          allAlerts.push(...alertsResult.data)
          totalSuccessfulChunks++;
        } else {
          console.error(`❌ [Chunk ${i+1}/4] Fallo al obtener alertas para org ${organizationId} (t0: ${t0ISO}, t1: ${t1ISO}): ${alertsResult.error} (Status: ${alertsResult.status})`)
          // Decide if we should stop or continue. For now, continue to get other chunks.
          // If a specific chunk fails due to rate limit, subsequent ones might also fail.
          if (alertsResult.status === 429) {
            console.warn(`🔶 [Chunk ${i+1}/4] Rate limit. Considerar detener o esperar más tiempo.`)
            // Potentially break or add a longer delay here if desired.
          }
        }
      } catch (chunkError) { // Catch unexpected errors from the getAlerts call itself
        console.error(`❌ [Chunk ${i+1}/4] Excepción crítica obteniendo alertas para org ${organizationId} (t0: ${t0ISO}, t1: ${t1ISO}): ${chunkError instanceof Error ? chunkError.message : String(chunkError)}`)
      }
      // Prepare for the next older chunk
      currentEndDate = currentStartDate
      // Add a small delay between large historical fetches
      if (i < 3) await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log(`✅ Finalizado getAllHistoryAlerts para org ${organizationId}. Total alertas: ${allAlerts.length} de ${totalSuccessfulChunks}/4 chunks exitosos.`)

    const allChunksAttempted = 4; // Assuming 4 chunks are always attempted
    const allChunksFailed = totalSuccessfulChunks === 0 && allAlerts.length === 0;
    const partialDataSuccess = totalSuccessfulChunks > 0 && totalSuccessfulChunks < allChunksAttempted;

    // To track if fallback was used in any chunk, we'd need to inspect each alertsResult.
    // Let's assume 'anyChunkUsedFallback' is a boolean that gets set to true if any alertsResult.usedNetworkFallback is true.
    // This requires alertsResult to be available or its relevant info stored from the loop.
    // For now, this property will be omitted from getAllHistoryAlerts return if not reliably tracked.
    // If alertsResult from the loop is not accessible here, we cannot set 'usedNetworkFallbackInChunks' accurately.

    return {
      success: !allChunksFailed, // Considered successful if at least one chunk succeeded or got some data.
      data: allAlerts,
      partial: partialDataSuccess || (allAlerts.length > 0 && totalSuccessfulChunks === 0), // True if some data but not all chunks, or if data exists despite 0 successful chunks (e.g. error after some data)
    }
  } catch (error) {
    console.error(`❌ Excepción mayor en getAllHistoryAlerts para la org ${organizationId}: ${error instanceof Error ? error.message : String(error)}`)
    return {
      success: false,
      error: error instanceof Error ? error.message : `Error desconocido obteniendo historial completo de alertas para la org ${organizationId}.`,
      status: 0,
      partial: false,
    }
  }
}

// Helper type for getAlerts return
export type GetAlertsResult =
  | { success: true; data: MerakiAlert[]; usedNetworkFallback?: boolean; partial?: boolean; }
  | { success: false; error: string; status: number; usedNetworkFallback?: boolean; partial?: boolean; };


// Función para generar alertas de prueba si no hay alertas reales
export async function generateTestAlerts(
  organizationId: string,
  networkIds: string[],
  timespanSeconds?: number // Optional timespan for generating alerts in a specific range
  ): Promise<MerakiAlert[]> {

  const now = Date.now();
  let baseTimestamp = now;

  if (timespanSeconds) {
    // If timespan is provided, generate alerts distributed within that past duration
    // For example, make the "latest" test alert be at the beginning of that timespan window
    baseTimestamp = now - timespanSeconds * 1000;
  }

  const testAlerts: MerakiAlert[] = [
    {
      id: `test_alert_1_${organizationId}_${Math.random().toString(36).substring(7)}`,
      type: "gateway_down",
      severity: "critical",
      message: "Gateway MX84 desconectado - Sin conectividad a Internet",
  timestamp: new Date(baseTimestamp - Math.floor(Math.random() * (timespanSeconds || 2*60*60)) * 1000).toISOString(),
      networkId: networkIds[0] || `test_network_1_${organizationId}`,
      networkName: "Red Principal",
      deviceSerial: "Q2XX-TEST-RND1",
      status: "active",
    },
    {
      id: `test_alert_2_${organizationId}_${Math.random().toString(36).substring(7)}`, // Unique ID
      type: "high_cpu_usage",
      severity: "warning",
      message: "Uso alto de CPU en switch MS220-8P (85%)",
      timestamp: new Date(baseTimestamp - Math.floor(Math.random() * (timespanSeconds || 4*60*60)) * 1000).toISOString(),
      networkId: networkIds[1] || `test_network_2_${organizationId}`,
      networkName: "Red Sucursal",
      deviceSerial: "Q2YY-TEST-RND2",
      status: "acknowledged",
    },
    {
      id: `test_alert_3_${organizationId}_${Math.random().toString(36).substring(7)}`, // Unique ID
      type: "client_connection_failed",
      severity: "info",
      message: "Múltiples fallos de conexión de clientes en AP MR36",
      timestamp: new Date(baseTimestamp - Math.floor(Math.random() * (timespanSeconds || 6*60*60)) * 1000).toISOString(),
      networkId: networkIds[2] || `test_network_3_${organizationId}`,
      networkName: "Red WiFi",
      deviceSerial: "Q2ZZ-TEST-RND3",
      status: "resolved",
    },
    {
      id: `test_alert_4_${organizationId}_${Math.random().toString(36).substring(7)}`, // Unique ID
      type: "bandwidth_exceeded",
      severity: "warning",
      message: "Ancho de banda excedido en enlace WAN (95% utilización)",
      timestamp: new Date(baseTimestamp - Math.floor(Math.random() * (timespanSeconds || 8*60*60)) * 1000).toISOString(),
      networkId: networkIds[0] || `test_network_1_${organizationId}`,
      networkName: "Red Principal",
      deviceSerial: "Q2AA-TEST-RND4",
      status: "active",
    },
    {
      id: `test_alert_5_${organizationId}_${Math.random().toString(36).substring(7)}`, // Unique ID
      type: "vpn_connectivity_change",
      severity: "critical",
      message: "Túnel VPN Site-to-Site desconectado",
      timestamp: new Date(baseTimestamp - Math.floor(Math.random() * (timespanSeconds || 12*60*60)) * 1000).toISOString(),
      networkId: networkIds[1] || `test_network_2_${organizationId}`,
      networkName: "Red Sucursal",
      deviceSerial: "Q2DD-TEST-RND5",
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
