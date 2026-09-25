/**
 * gpxExportService.js
 * 標準 GPX 1.1 航跡與地標匯出服務
 * 支援將旅程每日景點匯出為標準 GPX 航點與路線，
 * 可直接匯入 Garmin 手持設備、OsmAnd、Google Earth、CoMaps 或專業戶外導航 App。
 */

function escapeXml(unsafe = '') {
    if (!unsafe) return '';
    return unsafe
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

/**
 * 產出標準 GPX 1.1 XML 字串
 * @param {Object} trip
 * @param {Array<Object>} dayPlans
 * @returns {string}
 */
export function generateTripGpx(trip, dayPlans = []) {
    const timeIso = new Date().toISOString();
    const title = trip?.title || 'TREK-Trip';

    let waypointsXml = '';
    let trackPointsXml = '';

    dayPlans.forEach((plan, pIdx) => {
        const places = plan.places || [];
        places.forEach((place, plIdx) => {
            const lat = Number(place.lat);
            const lng = Number(place.lng);
            if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

            const name = place.name || `Day ${pIdx + 1} - 點位 ${plIdx + 1}`;
            const desc = place.notes || place.address || '';
            const ele = Number(place.ele) || 0;

            // 1. Waypoint <wpt>
            waypointsXml += `  <wpt lat="${lat}" lon="${lng}">\n`;
            waypointsXml += `    <name>${escapeXml(name)}</name>\n`;
            if (desc) waypointsXml += `    <desc>${escapeXml(desc)}</desc>\n`;
            if (ele > 0) waypointsXml += `    <ele>${ele}</ele>\n`;
            waypointsXml += `  </wpt>\n`;

            // 2. Trackpoint <trkpt>
            trackPointsXml += `      <trkpt lat="${lat}" lon="${lng}">\n`;
            trackPointsXml += `        <name>${escapeXml(name)}</name>\n`;
            trackPointsXml += `      </trkpt>\n`;
        });
    });

    const gpxString = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="TREK-Lite Travel Planner" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>${escapeXml(title)}</name>
    <time>${timeIso}</time>
  </metadata>
${waypointsXml}  <trk>
    <name>${escapeXml(title)} - 完整行程路線</name>
    <trkseg>
${trackPointsXml}    </trkseg>
  </trk>
</gpx>`;

    return gpxString;
}

/**
 * 觸發瀏覽器下載 .gpx 檔案
 * @param {string} filename
 * @param {string} gpxContent
 */
export function downloadGpxFile(filename = 'itinerary.gpx', gpxContent = '') {
    const blob = new Blob([gpxContent], { type: 'application/gpx+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename.endsWith('.gpx') ? filename : `${filename}.gpx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}
