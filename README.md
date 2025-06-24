# Meraki Alert Dashboard

## 1. Introduction/Overview

The Meraki Alert Dashboard is a web application designed to help network administrators monitor and manage alerts from their Cisco Meraki networks. It provides a user-friendly interface to connect to the Meraki API, view alerts across multiple organizations and networks, and gain insights into network activity.

Key features include:
*   Secure connection to the Meraki API using an API key.
*   Display of alerts from multiple organizations and their respective networks.
*   Comprehensive alert listing with details like severity, type, message, timestamp, and associated device.
*   Advanced filtering options by organization, network, severity, and search term.
*   Automatic mapping of Meraki alert types to severity levels (Critical, Warning, Info).
*   Auto-refresh functionality to keep the alert data up-to-date.
*   Export alerts to CSV format for reporting and analysis.
*   A "Test Data" mode for demonstration or when live data fetching encounters issues.
*   An "Activity Log & Warnings" section in the UI to provide feedback on data fetching processes.
*   Performance optimizations, including parallel fetching of data from Meraki APIs.

The application is built with Next.js, TypeScript, and Tailwind CSS, utilizing Shadcn/ui for components and Lucide Icons for iconography.

## 2. Features

*   **API Key Connection:** Securely input your Meraki API key to fetch data. The key is stored in component state for the duration of the session.
*   **Multi-Organization Support:** View networks and alerts aggregated from all organizations accessible by the API key.
*   **Comprehensive Alert Dashboard:**
    *   Statistics on alert counts by severity (Critical, Warning, Info).
    *   Paginated table displaying detailed alert information.
    *   Modal view for full alert details.
*   **Advanced Filtering:**
    *   Search by keyword across alert messages, network names, and device serials.
    *   Filter by specific organization.
    *   Filter by specific network.
    *   Filter by alert severity.
    *   Filter by time period (e.g., last hour, last day, up to 3 months).
*   **Dynamic Data Loading:**
    *   "Load More" functionality to progressively fetch older alerts.
    *   Auto-refresh option to periodically update alerts.
*   **Data Export:** Export the currently filtered alerts to a CSV file.
*   **Responsive Design:** User interface adapts to different screen sizes.
*   **Theming:** Light and Dark mode support.
*   **Test Data Mode:** Displays sample alerts if live data fetching fails or for initial demonstration.
*   **Activity Log:** Provides UI feedback on errors, warnings, or fallbacks encountered during data fetching from the Meraki API.

## 3. Tech Stack

*   **Framework:** Next.js (v13+ with App Router)
*   **Language:** TypeScript
*   **Styling:** Tailwind CSS
*   **UI Components:** Shadcn/ui
*   **Icons:** Lucide React
*   **State Management:** React Hooks (`useState`, `useEffect`, `useMemo`)
*   **API Interaction:** Native `fetch` API

## 4. Prerequisites

*   **Node.js:** Latest LTS version recommended.
*   **Package Manager:** `pnpm` is used in this project (as indicated by `pnpm-lock.yaml`). You can also use `npm` or `yarn`.
*   **Cisco Meraki Dashboard Account:** An active account with API access enabled.
*   **Meraki API Key:** Obtain an API key from your Meraki Dashboard profile (Organization > Settings > API access). Ensure the key has appropriate permissions (read-access to organizations, networks, and alerts).

## 5. Getting Started / Setup

1.  **Clone the repository:**
    ```bash
    git clone <repository-url>
    ```
2.  **Navigate to the project directory:**
    ```bash
    cd meraki-alert-dashboard
    ```
    (Replace `<repository-url>` and `meraki-alert-dashboard` with the actual URL and directory name if different)

3.  **Install dependencies:**
    Using `pnpm` (recommended):
    ```bash
    pnpm install
    ```
    Alternatively, using `npm` or `yarn`:
    ```bash
    npm install
    # or
    yarn install
    ```

4.  **API Key Configuration:**
    The Meraki API key is **not** stored in a configuration file or environment variable for this project. It is entered directly into the application's UI after launching.
    *   When you first run the application, you will be prompted to enter your API key.
    *   The API key is stored in the component's state and is used for all API requests during your session.
    *   It is not persisted beyond the current browser session by default. Closing the tab or browser will require re-entering the API key.

## 6. Running the Application Locally

1.  **Development Mode:**
    ```bash
    pnpm dev
    ```
    This command starts the Next.js development server, typically available at `http://localhost:3000`. The page will auto-update as you make changes to the code.

2.  **Production Build & Start (Optional):**
    To run the application in a production-like environment locally:
    *   Build the application:
        ```bash
        pnpm build
        ```
    *   Start the production server:
        ```bash
        pnpm start
        ```
    This will serve the optimized build of the application.

## 7. Deployment

Next.js applications can be deployed to various platforms. Vercel (by the creators of Next.js) is highly recommended for its seamless integration.

**General Steps (e.g., using Vercel):**

1.  **Push your code to a Git repository** (e.g., GitHub, GitLab, Bitbucket).
2.  **Sign up or log in to Vercel** (or your chosen platform).
3.  **Import your Git repository** into Vercel.
4.  **Configure Project Settings:**
    *   Vercel usually auto-detects Next.js projects and configures build settings appropriately.
    *   The framework preset should be "Next.js".
    *   The build command is typically `pnpm build` (or `next build`).
    *   The output directory is usually `.next`.
5.  **Environment Variables:**
    *   Currently, this application primarily relies on client-side API key input. No specific backend environment variables are required for basic operation.
    *   If future enhancements involve backend proxies for Meraki API calls or other server-side configurations, environment variables would be set in your deployment platform's project settings (e.g., Vercel's "Environment Variables" section).
6.  **Deploy.**

Other suitable platforms include Netlify, AWS Amplify, Google Cloud Run, Azure App Service, or any Node.js hosting environment.

## 8. Functionality Overview

*   **Connecting:** Upon first launch or after disconnecting, click the "Conectar" button. A dialog will appear prompting for your 40-character Meraki API key.
*   **Dashboard:** Once connected, the main dashboard displays:
    *   Statistics cards for Critical, Warning, Info, and Total alerts.
    *   Filter controls (search, organization, network, severity, timespan).
    *   An "Activity Log & Warnings" section showing feedback from data fetching operations.
    *   A paginated table listing alerts with key details.
*   **Filtering:** Use the input fields and dropdowns to refine the list of alerts displayed. The table updates automatically.
*   **Loading More Data:** If more historical data is available beyond the initially loaded timespan (default 24 hours), the "Cargar Más" button becomes active. Clicking it fetches alerts for progressively larger timespans (e.g., 3 days, 1 week, 1 month, 3 months).
*   **Auto-Refresh:** Toggle the "Auto ON/OFF" button to enable/disable automatic refreshing of alerts every 10 seconds.
*   **Export:** Click the "Exportar a Excel" button to download the currently filtered alerts as a CSV file.

## 9. Error Handling & Data Integrity

*   The application provides feedback on data fetching operations through:
    *   **Console Logs:** Detailed logs are available in the browser's developer console.
    *   **Activity Log & Warnings UI:** A dedicated section on the dashboard displays user-friendly messages about errors, fallbacks to alternative data fetching methods, or partial failures (e.g., if some networks within an organization fail to load).
*   **Test Data Mode:**
    *   If connecting to the Meraki API fails critically (e.g., invalid API key format before validation) or if no real alerts can be fetched initially, the dashboard will display sample "test data" to demonstrate its functionality.
    *   A badge indicates when test data is being shown. This mode is exited as soon as real alerts are successfully loaded.

## 10. Troubleshooting (Basic)

*   **Invalid API Key:**
    *   "Ensure your API key is correct and consists of 40 hexadecimal characters."
    *   "Verify that the API key is enabled and has the necessary read permissions for organizations, networks, and alerts in your Meraki Dashboard."
*   **No Data Loaded / "No hay alertas":**
    *   Check the "Activity Log & Warnings" section on the dashboard for any specific error messages.
    *   Open your browser's developer console (usually by pressing F12) and look for error messages related to API calls or data processing.
    *   Ensure that the selected Meraki organization(s) actually have alerts logged for the chosen timespan.
    *   If "Test Data" is shown, it indicates an issue with fetching live data.
*   **Performance Issues:**
    *   The initial data load might take some time, especially for Meraki accounts with a large number of organizations and networks. The application fetches data for each organization in parallel to optimize this.
    *   Subsequent actions like filtering are performed client-side and should be relatively fast.
*   **Browser Issues:**
    *   Try clearing your browser cache or using an incognito/private window if you suspect caching problems.

## 11. Contributing

Contributions are welcome! If you have suggestions for improvements or encounter any bugs, please feel free to:
*   Open an Issue on the GitHub repository.
*   Submit a Pull Request with your proposed changes.

## 12. License

This project is currently unlicensed. You may use and modify the code at your own discretion, but please be aware that no specific permissions or limitations are officially granted.
(Consider adding an MIT License or similar if you wish to make it open source formally.)

---
Generated with assistance from an AI coding agent.
Remember to replace `<repository-url>` with the actual URL.
```
