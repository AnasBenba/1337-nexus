# 1337.Nexus - Pitch Refiner AI Critique

This document outlines the various UI states for the "Pitch Refiner AI Critique" feature. The frontend prototype includes a developer toolbar that allows toggling between these states to test the user flow of the AI integration.

## UI State Mapping

Below is the list of interactive states (A to K) representing the lifecycle of an AI critique request:

*   **None (Entry Page):** The default dashboard view where the student can view their pitch and click the "Refine with AI" button.
*   **State A (Start):** The initial modal overlay (`#state-view-A`). It displays the introductory text, explains what the AI will analyze (problem statement, metrics, etc.), and provides the "Request critique" button.
*   **State B (Submitting):** A transitional loading state (`#state-view-B`). Displays a spinning indicator and disabled buttons immediately after the user submits the request.
*   **State C (Queued / Processing):** The active job state (`#state-view-C`). Features a live 3-step progress tracker indicating that the pitch has been queued, is currently being analyzed, and is awaiting feedback synthesis.
*   **State D (Results):** Displays the completed AI critique, highlighting suggested improvements and actionable feedback.
*   **State E (Applying):** A transitional state showing the system actively applying the user's accepted AI suggestions to their draft.
*   **State F (Applied):** A success state confirming that the AI revisions have been successfully saved to the project pitch.
*   **State G (Stale):** Indicates that the user has manually edited their pitch since the last AI critique was generated, meaning the feedback might be outdated.
*   **State H (Conflict):** Highlights a version control issue, likely where manual edits clash with the AI's suggested edits.
*   **State I (Failed):** An error state displaying a message if the AI backend times out or fails to process the critique request.
*   **State J (Empty):** A placeholder state, likely shown when a pitch is completely blank and lacks enough context for the AI to analyze.
*   **State K (Mobile - 375px):** A viewport-specific state used by developers to preview how the modal and dashboard behave on small mobile screens.

---
*Note: In the provided source code snippet, the structural HTML for States A, B, and C are fully implemented as `<section>` blocks inside the modal, while States D through K are defined in the developer toolbar for future implementation.*