// ============================================================================
// What each channel actually says.
//
// Coordinates are included here whenever the alert has them, unlike the
// family dashboard's family_links.can_view_location gate. That gate is about
// ongoing surveillance access for people with standing app access; this is
// telling someone we're actively asking to go check on the elderly person
// where the emergency is happening right now. Different question, different
// answer — see BUILD_LOG.md.
// ============================================================================

function mapsLink(latitude, longitude) {
  return `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
}

/** @param {object} alert  a raw `alerts` row */
export function buildAlertMessage(alert, elderlyName) {
  const when = new Date(alert.triggered_at).toLocaleString();
  const hasLocation = alert.latitude != null && alert.longitude != null;
  const locationSentence = hasLocation
    ? `Last known location: ${mapsLink(alert.latitude, alert.longitude)}`
    : 'Location was not available at the time.';

  const summary = `${elderlyName} pressed their SOS button at ${when}. ${locationSentence}`;

  return {
    push: {
      title: `SOS: ${elderlyName} needs help`,
      body: summary,
      data: { alertId: alert.id, type: 'sos_alert' },
      categoryId: 'sos-alert',
    },
    email: {
      subject: `Emergency alert: ${elderlyName}`,
      text: `${summary}\n\nOpen the ElderCare app to see more and respond.`,
    },
    sms: {
      text: `ElderCare SOS: ${summary}`,
    },
    voice_call: {
      // Spoken, not written — kept short and literal for a voice call. The
      // location link is not read aloud; a call is the fallback for someone
      // who can't be reached any other way, not the channel to read out a URL.
      text: `This is an emergency alert from Elder Care. ${elderlyName} has pressed their emergency button and needs help. Please open the Elder Care app or contact them directly.`,
    },
  };
}
