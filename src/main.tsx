import React from 'react';
import App from './App.tsx'
import './index.css'
import {createRoot} from "react-dom/client";
import {PaginationProvider} from "./contexts/paginationProvider.tsx";
import {SnackbarProvider} from "./contexts/snackbarProvider.tsx";
import {Auth0Provider} from "@auth0/auth0-react";
import {config} from "./config.ts";

createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <Auth0Provider
            domain={config.auth0Domain}
            clientId={config.auth0ClientId}
            authorizationParams={{
                redirect_uri: window.location.origin,
                audience: config.auth0Audience
            }}
        >
            <PaginationProvider>
                <SnackbarProvider>
                    <App/>
                </SnackbarProvider>
            </PaginationProvider>
        </Auth0Provider>
    </React.StrictMode>,
)
