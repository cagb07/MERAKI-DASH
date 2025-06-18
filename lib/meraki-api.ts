// lib/meraki-api.ts

/**
 * Represents a Meraki alert.
 * @property id - Unique identifier for the alert.
 * @property type - Type of the alert (e.g., "gateway_down").
 * @property severity - Severity of the alert: "critical", "warning", or "info".
 * @property message - Descriptive message for the alert.
 * @property timestamp - ISO string representing when the alert occurred.
 * @property networkId - ID of the network associated with the alert.
 * @property networkName - Name of the network, derived from network list.
 * @property deviceSerial - Serial number of the device involved, if applicable.
 * @property status - Current status of the alert (e.g., "active", "acknowledged").
 */
export interface Alert {
  id: string;
  type: string;
  severity: "critical" | "warning" | "info";
  message: string;
  timestamp: string;
  networkId: string;
  networkName: string;
  deviceSerial: string;
  status: "active" | "acknowledged" | "resolved";
}

/**
 * Represents a Meraki organization.
 * @property id - Unique identifier for the organization.
 * @property name - Name of the organization.
 */
export interface Organization {
  id: string;
  name: string;
}

/**
 * Represents a Meraki network.
 * @property id - Unique identifier for the network.
 * @property name - Name of the network.
 * @property organizationId - ID of the organization this network belongs to.
 */
export interface Network {
  id: string;
  name: string;
  organizationId: string;
}

/**
 * Structure for the initial data payload from the simulated API.
 */
interface MerakiApiData {
  organizations: Organization[];
  networks: Network[];
  alerts: Alert[];
}

/**
 * Simulates an API call delay.
 * @param ms - The number of milliseconds to delay.
 * @returns A Promise that resolves after the specified delay.
 */
const delay = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Simulates connecting to the Meraki API and fetching initial dashboard data.
 * This includes organizations, networks, and a set of sample alerts.
 * @param apiKey - The Meraki API key for simulated validation.
 * @returns A Promise resolving to an object containing organizations, networks, and alerts.
 * @throws Error if the API key is considered invalid by the simulation.
 */
export const connectAndFetchInitialData = async (apiKey: string): Promise<MerakiApiData> => {
  await delay(2000); // Simulate network latency for initial connection

  // Basic API key validation for simulation purposes
  if (apiKey.length < 20) {
    throw new Error("API Key parece ser inválida. Debe tener al menos 20 caracteres.");
  }
  // Specific key to test error handling in the simulation
  if (apiKey === "error_test_key") {
    throw new Error("Simulated API Connection Error: Invalid credentials.");
  }

  // Sample data for organizations
  const sampleOrgs: Organization[] = [
    { id: "org_1", name: "Oficina Principal" },
    { id: "org_2", name: "Sucursal Norte" },
    { id: "org_3", name: "Planta Baja" },
  ];

  // Sample data for networks
  const sampleNetworks: Network[] = [
    { id: "N_123456789", name: "Red Principal (Oficina)", organizationId: "org_1" },
    { id: "N_987654321", name: "Red Sucursal (Norte)", organizationId: "org_2" },
    { id: "N_456789123", name: "Red Planta Baja", organizationId: "org_3" },
    { id: "N_789012345", name: "Red Invitados (Oficina)", organizationId: "org_1" },
  ];

  // Sample data for alerts, ensuring networkName is derived from the sampleNetworks
  const sampleAlerts: Alert[] = [
    {
      id: "alert_001", // Example critical alert
      type: "gateway_down",
      severity: "critical",
      message: "Gateway MX84 en Oficina Principal desconectado",
      timestamp: new Date().toISOString(),
      networkId: "N_123456789",
      networkName: sampleNetworks.find(n => n.id === "N_123456789")?.name || "Unknown Network", // Derive name
      deviceSerial: "Q2XX-XXXX-XXXX",
      status: "active",
    },
    {
      id: "alert_002", // Example warning alert
      type: "high_cpu_usage",
      severity: "warning",
      message: "Uso alto de CPU en switch MS220-8P",
      timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
      networkId: "N_987654321",
      networkName: sampleNetworks.find(n => n.id === "N_987654321")?.name || "Unknown Network", // Derive name
      deviceSerial: "Q2YY-YYYY-YYYY",
      status: "acknowledged",
    },
    {
      id: "alert_003", // Example info alert
      type: "client_connection_failed",
      severity: "info",
      message: "Múltiples fallos de conexión de clientes en AP MR36",
      timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(), // 4 hours ago
      networkId: "N_456789123",
      networkName: sampleNetworks.find(n => n.id === "N_456789123")?.name || "Unknown Network", // Derive name
      deviceSerial: "Q2ZZ-ZZZZ-ZZZZ",
      status: "resolved",
    },
  ];

  return {
    organizations: sampleOrgs,
    networks: sampleNetworks,
    alerts: sampleAlerts,
  };
};

/**
 * Simulates fetching the latest alerts from the Meraki API.
 * In this simulation, it typically returns one new randomly generated alert.
 * @param apiKey - The Meraki API key (used for simulated validation).
 * @returns A Promise resolving to an array of new Alert objects.
 * @throws Error if the API key is considered invalid or if a simulated fetch error occurs.
 */
export const fetchLatestAlerts = async (apiKey: string): Promise<Alert[]> => {
  await delay(1500); // Simulate network latency for fetching alerts

  // Basic API key validation, though primary validation happens at connect
  if (apiKey.length < 20) {
    throw new Error("API Key inválida para obtener alertas.");
  }
  // Specific key to test error handling for refresh in the simulation
   if (apiKey === "error_refresh_key") {
    throw new Error("Simulated API Error: Failed to fetch latest alerts.");
  }

  // For this simulation, pick a network to associate the new alert with.
  // In a real scenario, this would be determined by the API response.
  const commonNetwork = { id: "N_123456789", name: "Red Principal (Oficina)"};

  // Generate a new sample alert
  const newAlert: Alert = {
    id: `alert_${Date.now()}`,
    type: "new_device_online",
    severity: "info",
    message: `Nuevo dispositivo detectado: ${Math.random().toString(36).substring(7)}`,
    timestamp: new Date().toISOString(),
    networkId: commonNetwork.id,
    networkName: commonNetwork.name,
    deviceSerial: `Q2AB-C${Math.random().toString(36).substring(2, 6).toUpperCase()}-DEFG`,
    status: "active",
  };
  return [newAlert]; // Return as an array
};
