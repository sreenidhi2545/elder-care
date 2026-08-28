// ============================================================================
// The one thing backgroundLocationTask.js and backgroundTracking.js both
// need — kept in its own file so neither has to import the other.
// backgroundLocationTask.js defines the task under this name;
// backgroundTracking.js starts/stops it under the same name. Importing
// backgroundLocationTask.js from backgroundTracking.js (or vice versa) would
// create a cycle for no reason beyond sharing one string.
// ============================================================================

export const BACKGROUND_LOCATION_TASK = 'eldercare-background-location';
