# CropTwin AI: Project Implementation Plan
**Project Identity:** A full-stack AI digital twin platform for precision urban vertical farming[cite: 12].

## Core Innovation Layers
*   **Digital Twin Dashboard**: Each farm layer is visualized as a virtual crop environment[cite: 12].
*   **Crop Health Score**: Converts multiple sensor readings into a unified 0–100 score[cite: 12].
*   **Predictive Alerting**: Estimates future risks based on historical data trends[cite: 12].
*   **Chat-to-Farm Assistant**: Explains farm conditions in natural language[cite: 12].

## System Architecture
*   **Simulator/IoT**: Generates real-time sensor data for temperature, pH, and moisture[cite: 12].
*   **Backend (FastAPI)**: Validates data, stores it in DB, calculates scores, and pushes updates[cite: 12].
*   **Database (SQLite/Supabase)**: Stores farm metadata, crop recipes, and time-series sensor data[cite: 12].
*   **Frontend (React)**: High-fidelity dashboard using Recharts for visualization and Lucide-React for icons[cite: 12].

## Implementation Priorities (MVP)
1.  **Must Have**: Real-time IoT monitoring and the Digital Twin Dashboard[cite: 12].
2.  **Must Have**: Alert engine and automated device control panel[cite: 12].
3.  **Must Have**: AI Recommendation engine and Chat-to-Farm interface[cite: 12].

## Health Score Mapping
*   **90–100**: Healthy (Ideal conditions)[cite: 12].
*   **70–89**: Attention (Slight deviation)[cite: 12].
*   **50–69**: Warning (Crop condition may be affected)[cite: 12].
*   **0–49**: Critical (Immediate action required)[cite: 12].