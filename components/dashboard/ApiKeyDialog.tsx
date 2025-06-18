"use client"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Shield } from "lucide-react"

/**
 * Props for the ApiKeyDialog component.
 * @property showApiKeyDialog - Boolean to control the visibility of the dialog.
 * @property setShowApiKeyDialog - Function to set the visibility of the dialog.
 * @property tempApiKey - Temporary state for the API key input field.
 * @property setTempApiKey - Function to update the temporary API key state.
 * @property handleApiKeySubmit - Callback function when the API key is submitted.
 * @property apiKey - The currently stored API key (if any), used to determine button text ("Conectar" vs "Actualizar").
 */
interface ApiKeyDialogProps {
  showApiKeyDialog: boolean;
  setShowApiKeyDialog: (open: boolean) => void;
  tempApiKey: string;
  setTempApiKey: (key: string) => void;
  handleApiKeySubmit: () => void;
  apiKey: string;
}

/**
 * ApiKeyDialog is a modal dialog component that allows users to input or update
 * their Meraki API key. It includes a disclaimer about local storage security.
 */
export default function ApiKeyDialog({
  showApiKeyDialog,
  setShowApiKeyDialog,
  tempApiKey,
  setTempApiKey,
  handleApiKeySubmit,
  apiKey,
}: ApiKeyDialogProps) {
  return (
    <Dialog open={showApiKeyDialog} onOpenChange={setShowApiKeyDialog}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Configurar API Key de Meraki
          </DialogTitle>
          <DialogDescription>
            Ingresa tu API Key de Meraki Dashboard para conectarte. Puedes encontrarla en tu perfil de Meraki
            Dashboard.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="apikey" className="text-sm font-medium">
              API Key
            </label>
            <Input
              id="apikey"
              type="password"
              placeholder="Ingresa tu API Key de Meraki..."
              value={tempApiKey}
              onChange={(e) => setTempApiKey(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleApiKeySubmit()
                }
              }}
            />
            <p className="text-xs text-muted-foreground">
              El API Key debe tener al menos 20 caracteres.
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              <span className="font-semibold">Nota:</span> Tu API Key se guarda en el almacenamiento local de tu navegador.
              Para mayor seguridad, considera usar una ventana de incógnito o limpiar los datos de tu navegador después de usar la aplicación.
            </p>
          </div>

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowApiKeyDialog(false)
                setTempApiKey("") // Clear temp key on cancel
              }}
            >
              Cancelar
            </Button>
            <Button onClick={handleApiKeySubmit} disabled={!tempApiKey.trim()}>
              {apiKey ? "Actualizar" : "Conectar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
