"use client"

import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

// Types are expected to be imported from a central location like `lib/meraki-api.ts` or `types/meraki.ts`
// For this component, we assume `Organization` and `Network` types are passed in as props.
import type { Organization, Network } from "@/lib/meraki-api"; // Adjust path as needed

/**
 * Props for the AlertFilters component.
 * @property searchTerm - Current search term string.
 * @property setSearchTerm - Function to update the search term.
 * @property selectedOrg - Currently selected organization ID (or "all").
 * @property setSelectedOrg - Function to update the selected organization.
 * @property organizations - Array of available organizations.
 * @property selectedNetwork - Currently selected network ID (or "all").
 * @property setSelectedNetwork - Function to update the selected network.
 * @property networks - Array of available networks (potentially pre-filtered by organization).
 * @property selectedSeverity - Currently selected severity level (or "all").
 * @property setSelectedSeverity - Function to update the selected severity.
 */
interface AlertFiltersProps {
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  selectedOrg: string;
  setSelectedOrg: (org: string) => void;
  organizations: Organization[];
  selectedNetwork: string;
  setSelectedNetwork: (network: string) => void;
  networks: Network[];
  selectedSeverity: string;
  setSelectedSeverity: (severity: string) => void;
}

/**
 * AlertFilters component provides UI elements for filtering alerts.
 * This includes a search input, and dropdowns for organization, network, and severity.
 */
export default function AlertFilters({
  searchTerm,
  setSearchTerm,
  selectedOrg,
  setSelectedOrg,
  organizations,
  selectedNetwork,
  setSelectedNetwork,
  networks,
  selectedSeverity,
  setSelectedSeverity,
}: AlertFiltersProps) {
  return (
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
              {/* Assuming networks are pre-filtered by selectedOrg if necessary, or all networks are shown */}
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
  )
}
