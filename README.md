# Meraki Network Alerts Dashboard

This project is a web-based dashboard for monitoring network alerts from a Cisco Meraki environment. It allows users to connect using their Meraki API key, view, filter, and manage alerts in a user-friendly interface. Currently, it uses simulated data to showcase functionality.

[![Deployed on Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-black?style=for-the-badge&logo=vercel)](https://vercel.com/cagb07s-projects/v0-mejorar-codigo-dashboard)

## Features

*   **API Key Connection:** Securely "connect" to the Meraki environment (simulated) using your API key. The key is stored locally in your browser.
*   **Alert Viewing:** Display network alerts in a clear, sortable, and paginated table.
*   **Detailed Alert Information:** View comprehensive details for each alert in a dialog.
*   **Filtering:** Filter alerts by organization, network, severity, and a search term (message, network name, device serial).
*   **Statistics:** View a summary of alerts by severity (Critical, Warning, Info) with visual indicators.
*   **Auto-Refresh:** Automatically refresh alerts at regular intervals with optional sound notifications for new alerts.
*   **Export:** Export the filtered list of alerts to a CSV file.
*   **Theme Toggle:** Switch between light and dark mode for better visibility.
*   **Responsive Design:** Adapts to different screen sizes for use on desktop and mobile devices.

## Prerequisites

Before you begin, ensure you have the following installed:

*   [Node.js](https://nodejs.org/) (v18.x or later recommended)
*   [pnpm](https://pnpm.io/) (or npm/yarn, though pnpm is used in `package.json` scripts)

## Getting Started

1.  **Clone the repository:**
    ```bash
    git clone <repository_url>
    cd <repository_directory>
    ```
    *Replace `<repository_url>` with the actual URL of this repository.*

2.  **Install dependencies:**
    If using pnpm:
    ```bash
    pnpm install
    ```
    If using npm:
    ```bash
    npm install
    ```
    If using yarn:
    ```bash
    yarn install
    ```

3.  **Run the development server:**
    If using pnpm:
    ```bash
    pnpm run dev
    ```
    If using npm:
    ```bash
    npm run dev
    ```
    If using yarn:
    ```bash
    yarn dev
    ```
    Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Configuration

*   **API Key:**
    *   Upon first use, or by clicking "Cambiar API Key", you will be prompted to enter your Meraki Dashboard API Key.
    *   This key is required to "connect" and fetch alert data (currently simulated).
    *   The API key is stored in your browser's `localStorage` for persistence across sessions.
    *   **Security Note:** Storing API keys in `localStorage` is convenient for development but carries security risks (e.g., XSS attacks). For production environments, a backend proxy approach for handling API keys is recommended.

## Technologies Used

*   **Framework:** [Next.js](https://nextjs.org/) (v14+)
*   **Language:** [TypeScript](https://www.typescriptlang.org/)
*   **UI Components:** [shadcn/ui](https://ui.shadcn.com/) - Radix UI + Tailwind CSS
*   **Styling:** [Tailwind CSS](https://tailwindcss.com/)
*   **Icons:** [Lucide React](https://lucide.dev/)

## Notes on Simulated Data

This version of the dashboard uses **simulated API calls and sample data** for organizations, networks, and alerts. This is defined in `lib/meraki-api.ts`. To connect to a real Meraki API, you would need to replace the functions in this file with actual HTTP requests to the Meraki Dashboard API endpoints.