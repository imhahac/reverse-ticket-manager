import { describe, it, expect } from 'vitest';
import { parseGpx, parseKml, parseMapLinks } from '../geoImportService';

describe('GeoImportService - GPX, KML & Map Links', () => {
    it('should parse GPX XML with waypoints correctly', () => {
        const sampleGpx = `<?xml version="1.0" encoding="UTF-8"?>
        <gpx version="1.1" creator="Test">
            <wpt lat="25.033964" lon="121.564472">
                <name>Taipei 101</name>
                <desc>Landmark tower</desc>
                <ele>508.0</ele>
            </wpt>
            <wpt lat="25.037486" lon="121.563666">
                <name>Taipei City Hall</name>
            </wpt>
        </gpx>`;

        const places = parseGpx(sampleGpx);
        expect(places.length).toBe(2);
        expect(places[0].name).toBe('Taipei 101');
        expect(places[0].lat).toBeCloseTo(25.033964);
        expect(places[0].lng).toBeCloseTo(121.564472);
        expect(places[0].ele).toBe(508.0);
        expect(places[1].name).toBe('Taipei City Hall');
    });

    it('should parse KML with placemarks correctly', () => {
        const sampleKml = `<?xml version="1.0" encoding="UTF-8"?>
        <kml xmlns="http://www.opengis.net/kml/2.2">
            <Document>
                <Placemark>
                    <name>Tokyo Tower</name>
                    <description>Iconic red tower</description>
                    <Point>
                        <coordinates>139.7454,35.6586,333</coordinates>
                    </Point>
                </Placemark>
            </Document>
        </kml>`;

        const places = parseKml(sampleKml);
        expect(places.length).toBe(1);
        expect(places[0].name).toBe('Tokyo Tower');
        expect(places[0].lat).toBeCloseTo(35.6586);
        expect(places[0].lng).toBeCloseTo(139.7454);
        expect(places[0].desc).toBe('Iconic red tower');
    });

    it('should extract Google Maps and raw coordinates from text', () => {
        const text = `
Check out this place:
https://www.google.com/maps/place/Taipei+101/@25.033964,121.564472,17z/data=xxx
And this view:
https://www.google.com/maps?q=35.6586,139.7454
Also plain coords:
25.1023, 121.5485
        `;

        const places = parseMapLinks(text);
        expect(places.length).toBe(3);
        expect(places[0].name).toBe('Taipei 101');
        expect(places[0].lat).toBeCloseTo(25.033964);
        expect(places[0].lng).toBeCloseTo(121.564472);
        expect(places[1].lat).toBeCloseTo(35.6586);
        expect(places[1].lng).toBeCloseTo(139.7454);
        expect(places[2].lat).toBeCloseTo(25.1023);
        expect(places[2].lng).toBeCloseTo(121.5485);
    });
});
