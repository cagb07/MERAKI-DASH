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
      const error = new Error(`API call to /organizations/${organizationId}/alerts/history failed with status ${response.status}`);
      console.warn(`Endpoint de organización falló (status: ${response.status}), intentando con redes individuales... Error: ${error.message}`);
      const fallbackResult = await getAlertsFromNetworks(apiKey, organizationId, timespan);
      // Ensure fallbackResult has a clearly defined structure even on its own internal failures
      if (fallbackResult.success) {
        return {
          ...fallbackResult,
          fallback: true,
          initialError: error.message,
        };
      } else {
        // If getAlertsFromNetworks also fails, return its error and the initial error
        return {
          success: false,
          error: fallbackResult.error,
          initialError: error.message,
          fallback: true,
          data: [], // Ensure data is always an array
        };
      }
    }

    const alertsData = await response.json()
    console.log(`Alertas obtenidas: ${alertsData.length}`)

    // Transformar los datos de Meraki al formato de nuestra aplicación
    const alerts: MerakiAlert[] = alertsData.map((alert: any, index: number) => {
      let id_var_name = alert.id || alert.alertId;
      if (!id_var_name) {
        id_var_name = `generated_org_${organizationId}_${index}`;
        console.warn(`Generated fallback ID for alert. Entity: ${organizationId}, Index: ${index}. Original alert data:`, alert);
      }

      const alertMessage = alert.message || alert.details || alert.description;
      if (!alertMessage) {
        console.warn(`Alert message is missing for alert ID '${id_var_name}'. Using default. Original alert:`, alert);
      }

      const alertTimestamp = alert.occurredAt || alert.timestamp || alert.time;
      if (!alertTimestamp) {
        console.warn(`Alert timestamp is missing for alert ID '${id_var_name}'. Using current time as default. Original alert:`, alert);
      }

      return {
        id: id_var_name,
        type: alert.type || alert.alertType || "unknown",
        message: alertMessage || "Sin mensaje",
        timestamp: alertTimestamp || new Date().toISOString(),
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
      fallback: false, // Explicitly set fallback to false for primary success
    };
  } catch (error) {
    console.error(`Error obteniendo alertas para organización ${organizationId}:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error desconocido",
      data: [], // Ensure data is always an array on error
    };
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
    const partialErrors: { networkId: string; networkName: string; error: string }[] = []

    // Create an array of promises for fetching alerts from each network
    const alertPromises = networksResult.data.map(async (network) => {
      try {
        const response = await fetch(`${MERAKI_API_BASE}/networks/${network.id}/alerts/history?timespan=${timespan}`, {
          headers: {
            "X-Cisco-Meraki-API-Key": apiKey,
            "Content-Type": "application/json",
          },
        });

        if (!response.ok) {
          // This error will be caught by the outer catch and handled by Promise.allSettled
          throw new Error(`Failed with status ${response.status} ${response.statusText}`);
        }

        const alertsData = await response.json();
        const networkAlerts: MerakiAlert[] = alertsData.map((alert: any, index: number) => {
          let id_var_name = alert.id || alert.alertId;
          if (!id_var_name) {
            id_var_name = `generated_net_${network.id}_${index}`;
            console.warn(`Generated fallback ID for alert. Entity: ${network.id}, Index: ${index}. Original alert data:`, alert);
          }

          const alertMessage = alert.message || alert.details || alert.description;
          if (!alertMessage) {
            console.warn(`Alert message is missing for alert ID '${id_var_name}'. Using default. Original alert:`, alert);
          }

          const alertTimestamp = alert.occurredAt || alert.timestamp || alert.time;
          if (!alertTimestamp) {
            console.warn(`Alert timestamp is missing for alert ID '${id_var_name}'. Using current time as default. Original alert:`, alert);
          }

          return {
            id: id_var_name,
            type: alert.type || alert.alertType || "unknown",
            message: alertMessage || "Sin mensaje",
            timestamp: alertTimestamp || new Date().toISOString(),
            networkId: network.id,
            networkName: network.name,
            deviceSerial: alert.deviceSerial || alert.device?.serial || alert.serial || "",
            deviceName: alert.deviceName || alert.device?.name || alert.name || "",
            severity: mapSeverity(alert.type || alert.alertType, alert.category || alert.severity),
            status: alert.dismissed || alert.resolved ? "resolved" : "active",
          };
        });
        // Return a structure that Promise.allSettled can work with if we didn't want its auto-wrapping
        // but since we do, we just return the data for a 'fulfilled' case.
        return { networkId: network.id, networkName: network.name, data: networkAlerts, count: networkAlerts.length };
      } catch (networkError: any) {
        // This makes sure that an error in one network's fetch/processing
        // gets caught and can be reported in partialErrors.
        // Promise.allSettled expects a rejection to be an Error or similar.
        // We will package it with more info.
        throw { networkId: network.id, networkName: network.name, error: networkError.message };
      }
    });

    // Execute all promises in parallel and wait for all to settle
    const results = await Promise.allSettled(alertPromises);

    results.forEach(result => {
      if (result.status === 'fulfilled') {
        allAlerts.push(...result.value.data);
        console.log(`Successfully fetched ${result.value.count} alerts from network ${result.value.networkName} (${result.value.networkId})`);
      } else if (result.status === 'rejected') {
        // The 'reason' here is what we threw in the catch block of the promise
        const errorInfo = result.reason as { networkId: string; networkName: string; error: string };
        console.error(`Error obteniendo alertas de red ${errorInfo.networkName} (${errorInfo.networkId}):`, errorInfo.error);
        partialErrors.push({
          networkId: errorInfo.networkId,
          networkName: errorInfo.networkName,
          error: errorInfo.error
        });
      }
    });

    return {
      success: true, // Overall operation is successful if getNetworks worked, even with partial failures
      data: allAlerts,
      partialErrors: partialErrors,
    }
  } catch (error) {
    console.error(`Error in getAlertsFromNetworks for organization ${organizationId}:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error desconocido",
      data: [], // Ensure data is always an array
      partialErrors: [], // Ensure partialErrors is always an array
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

    const alerts: MerakiAlert[] = alertsData.map((alert: any, index: number) => {
      let id_var_name = alert.id || alert.alertId;
      if (!id_var_name) {
        id_var_name = `generated_net_${networkId}_${index}`;
        console.warn(`Generated fallback ID for alert. Entity: ${networkId}, Index: ${index}. Original alert data:`, alert);
      }

      const alertMessage = alert.message || alert.details || alert.description;
      if (!alertMessage) {
        console.warn(`Alert message is missing for alert ID '${id_var_name}'. Using default. Original alert:`, alert);
      }

      const alertTimestamp = alert.occurredAt || alert.timestamp || alert.time;
      if (!alertTimestamp) {
        console.warn(`Alert timestamp is missing for alert ID '${id_var_name}'. Using current time as default. Original alert:`, alert);
      }

      return {
        id: id_var_name,
        type: alert.type || alert.alertType || "unknown",
        message: alertMessage || "Sin mensaje",
        timestamp: alertTimestamp || new Date().toISOString(),
        networkId: networkId,
        networkName: alert.networkName || "Red desconocida", // Potentially enhance if network details are available
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
    console.error(`Error in getNetworkAlerts for network ${networkId}:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error desconocido",
      data: [], // Ensure data is always an array
    }
  }
}

export async function getAllHistoryAlerts(apiKey: string, organizationId: string) {
  try {
    // Meraki permite máximo 90 días en una sola consulta
    const maxTimespan = 7776000 // 90 días
    const allAlerts: MerakiAlert[] = []
    const fetchErrors: { chunk?: number; t0?: number; t1?: number; networkId?: string; networkName?: string; error: string }[] = []

    // Meraki permite máximo 90 días en una sola consulta
    const maxTimespan = 7776000 // 90 días en segundos
    const allAlerts: MerakiAlert[] = []
    // fetchErrors will store more structured error info
    const fetchErrors: { chunk: number; t0: number; t1: number; type: string; message: string; details?: any }[] = []

    // 1. Prepare Chunk Date Ranges
    const chunkDateRanges: { t0: number; t1: number; chunkIndex: number }[] = []
    let currentEndDate = new Date()
    for (let i = 0; i < 4; i++) {
      const t1 = Math.floor(currentEndDate.getTime() / 1000)
      const t0 = Math.floor(currentEndDate.getTime() / 1000) - maxTimespan
      chunkDateRanges.push({ t0, t1, chunkIndex: i })
      currentEndDate = new Date(t0 * 1000) // Use t0 for the next iteration's end date
    }

    // 2. Create an array of promises for fetching each chunk
    const chunkPromises = chunkDateRanges.map(async (range) => {
      const { t0, t1, chunkIndex } = range
      const chunkAlerts: MerakiAlert[] = []
      const chunkSpecificErrors: typeof fetchErrors = [] // Errors specific to this chunk processing

      try {
        const response = await fetch(
          `${MERAKI_API_BASE}/organizations/${organizationId}/alerts/history?t0=${t0}&t1=${t1}`,
          {
            headers: { "X-Cisco-Meraki-API-Key": apiKey, "Content-Type": "application/json" },
          }
        );

        if (response.ok) {
          const alertsData = await response.json();
          console.log(`Chunk ${chunkIndex + 1}: Successfully fetched ${alertsData.length} alerts for organization ${organizationId} (t0: ${t0}, t1: ${t1})`);
          const mappedAlerts: MerakiAlert[] = alertsData.map((alert: any, index: number) => {
            let id_var_name = alert.id || alert.alertId;
            if (!id_var_name) {
              id_var_name = `generated_org_chunk_${organizationId}_${chunkIndex}_${index}`;
              console.warn(`Generated fallback ID for alert. Entity: ${organizationId} (chunk ${chunkIndex + 1}), Index: ${index}. Original alert data:`, alert);
            }
            const alertMessage = alert.message || alert.details || alert.description;
            if (!alertMessage) console.warn(`Alert message is missing for alert ID '${id_var_name}'. Using default. Original alert:`, alert);
            const alertTimestamp = alert.occurredAt || alert.timestamp || alert.time;
            if (!alertTimestamp) console.warn(`Alert timestamp is missing for alert ID '${id_var_name}'. Using current time as default. Original alert:`, alert);
            return {
              id: id_var_name,
              type: alert.type || alert.alertType || "unknown",
              message: alertMessage || "Sin mensaje",
              timestamp: alertTimestamp || new Date().toISOString(),
              networkId: alert.networkId || alert.network?.id || "",
              networkName: alert.networkName || alert.network?.name || "Red desconocida",
              deviceSerial: alert.deviceSerial || alert.device?.serial || alert.serial || "",
              deviceName: alert.deviceName || alert.device?.name || alert.name || "",
              severity: mapSeverity(alert.type || alert.alertType, alert.category || alert.severity),
              status: alert.dismissed || alert.resolved ? "resolved" : "active",
            };
          });
          chunkAlerts.push(...mappedAlerts);
        } else {
          const errorMsg = `Organization-level alert fetch failed for chunk ${chunkIndex + 1} (t0: ${t0}, t1: ${t1}) with status ${response.status}. Attempting fallback.`;
          console.warn(errorMsg);
          chunkSpecificErrors.push({ chunk: chunkIndex + 1, t0, t1, type: "ORG_FETCH_FAILED", message: `Org API call failed: ${response.status}` });

          const chunkTimespanForFallback = t1 - t0; // This is maxTimespan
          const networkAlertsResult = await getAlertsFromNetworks(apiKey, organizationId, chunkTimespanForFallback);

          if (networkAlertsResult.success) {
            chunkAlerts.push(...networkAlertsResult.data);
            console.log(`Chunk ${chunkIndex + 1}: Successfully fetched ${networkAlertsResult.data.length} alerts via network fallback.`);
            if (networkAlertsResult.partialErrors && networkAlertsResult.partialErrors.length > 0) {
              console.warn(`Chunk ${chunkIndex + 1}: Fallback to networks had partial errors.`);
              networkAlertsResult.partialErrors.forEach(pError => {
                chunkSpecificErrors.push({
                  chunk: chunkIndex + 1, t0, t1, type: "NETWORK_PARTIAL_ERROR",
                  message: `Partial error in network ${pError.networkName || pError.networkId}: ${pError.error}`,
                  details: pError
                });
              });
            }
          } else {
            const fallbackErrorMsg = `Fallback to network-level fetch also failed for chunk ${chunkIndex + 1}. Error: ${networkAlertsResult.error}`;
            console.error(fallbackErrorMsg);
            chunkSpecificErrors.push({ chunk: chunkIndex + 1, t0, t1, type: "NETWORK_FALLBACK_FAILED", message: `Network fallback failed: ${networkAlertsResult.error}` });
          }
        }
      } catch (error: any) {
        console.error(`Critical error processing chunk ${chunkIndex + 1} (t0: ${t0}, t1: ${t1}):`, error.message);
        chunkSpecificErrors.push({ chunk: chunkIndex + 1, t0, t1, type: "CHUNK_PROCESSING_ERROR", message: error.message });
      }
      return { chunk: chunkIndex + 1, alerts: chunkAlerts, errors: chunkSpecificErrors };
    });

    // 3. Execute in Parallel
    const settledChunkResults = await Promise.allSettled(chunkPromises);

    // 4. Aggregate Results
    settledChunkResults.forEach(result => {
      if (result.status === 'fulfilled') {
        allAlerts.push(...result.value.alerts);
        fetchErrors.push(...result.value.errors); // Add errors collected from this chunk's processing
      } else {
        // This means the promise for a chunk itself was rejected, a more critical failure for that chunk.
        // The 'reason' might not have t0, t1 if the error happened before 'range' was available in promise scope.
        // However, our setup ensures range is available.
        const reason = result.reason as any;
        console.error(`Chunk promise rejected: `, reason);
        // Try to get chunk info if possible, otherwise log a general chunk failure
        const chunkInfo = reason.chunk !== undefined ? `chunk ${reason.chunk}` : `one of the chunks`;
        fetchErrors.push({
          chunk: reason.chunk ?? -1, // -1 or similar to indicate unknown chunk if not available
          t0: reason.t0 ?? 0,
          t1: reason.t1 ?? 0,
          type: "CHUNK_PROMISE_REJECTED",
          message: `Processing for ${chunkInfo} failed entirely: ${reason.message || String(reason)}`,
          details: reason
        });
      }
    });

    // Sort alerts by timestamp descending after all are collected
    allAlerts.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return {
      success: true, // The overall operation tried to fetch all data. Errors are in fetchErrors.
      data: allAlerts,
      fetchErrors: fetchErrors,
    }
  } catch (error) {
    console.error(`Critical error in getAllHistoryAlerts for organization ${organizationId}:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error desconocido",
      data: [],
      fetchErrors: fetchErrors, // Include any errors collected before the critical failure
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

  // Point 5: Enhanced mapSeverity logic
  const knownInfoTypes = ["client_connection_failed"]; // Add other known informational types if any
  if (!knownInfoTypes.some(t => lowerType.includes(t)) &&
      !criticalTypes.some(t => lowerType.includes(t)) &&
      !warningTypes.some(t => lowerType.includes(t)) &&
      !lowerCategory.includes("info") &&
      !lowerCategory.includes("warn") && !lowerCategory.includes("warning") &&
      !lowerCategory.includes("error") && !lowerCategory.includes("critical")) {
    console.warn(`Unknown alert type "${type}" (category: "${category}") mapped to INFO by default. Original alert type: ${type}, category: ${category}. Consider updating severity mappings.`);
  }
  return "info";
}
