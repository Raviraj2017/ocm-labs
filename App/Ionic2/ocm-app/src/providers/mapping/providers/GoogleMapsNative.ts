﻿import { GeoPosition, GeoLatLng, GeoBounds } from './../../../model/GeoPosition';
import { Logging, LogLevel } from './../../Logging';
/**
* @author Christopher Cook
* @copyright Webprofusion Ltd http://webprofusion.com
*/

/// <reference path="../../../../lib/typings/cordova-plugin-googlemaps/cordova-plugin-googlemaps.d.ts" />

import { Observable } from 'rxjs/Observable';
import { Utils } from '../../../core/Utils';
import { MappingAPI, IMapProvider, MapOptions, Mapping } from '../Mapping';
import { Events } from 'ionic-angular';
import { Dictionary } from 'typescript-collections';


declare var plugin: any;
declare var google: any;

/**Map Provider for Google Maps Native API (Cordova Plugin)
 * @module Mapping
 */

export class GoogleMapsNative implements IMapProvider {
    mapAPIType: MappingAPI;
    mapReady: boolean;
    providerError: string;
    mapCanvasID: string;

    private map: any;
    private markerList: Dictionary<number, google.maps.Marker>;
    private maxMarkers: number = 200;
    private markerAllocCount: number = 0;
    private polylinePath: any;

    /** @constructor */
    constructor(private events: Events, private logging: Logging) {

        this.mapAPIType = MappingAPI.GOOGLE_NATIVE;
        this.mapReady = false;
        this.mapCanvasID = "map-view";
        this.markerList = new Dictionary<number, any>();
    }

    /**
    * Performs one-time init of map object for this map provider
    * @param mapcanvasID  dom element for map canvas
    * @param mapConfig  general map config/options
    * @param mapManipulationCallback  custom handler for map zoom/drag events
    */
    initMap(mapCanvasID, mapConfig: MapOptions, parentMapManager: Mapping) {

        this.logging.log("GoogleMapsNative: initMap");
        this.mapCanvasID = mapCanvasID;

        var apiAvailable = true;
        if (plugin && plugin.google && plugin.google.maps) {
            apiAvailable = true;

            this.logging.log("Native maps plugin is available.");

            if (this.map == null) {

                var mapCanvas = document.getElementById(mapCanvasID);

                this.map = plugin.google.maps.Map.getMap(mapCanvas);

                let mapManagerContext = this;

                this.map.one(plugin.google.maps.event.MAP_READY, () => {
                    this.logging.log("Native Mapping Ready.", LogLevel.INFO);

                    var mapOptions = {
                        mapType: plugin.google.maps.MapTypeId.ROADMAP,
                        controls: {
                            compass: true,
                            myLocationButton: true,
                            zoom: true
                        },
                        gestures: {
                            scroll: true,
                            tilt: true,
                            rotate: true,
                            zoom: true
                        }
                    };

                    this.map.setOptions(mapOptions);
                    // mapManagerContext.map.setDiv(mapCanvas);
                    this.map.setVisible(true);
                    this.mapReady = true;
                    this.events.publish('ocm:mapping:ready');
                    this.setMapCenter(new GeoPosition(37.415328, -122.076575));//native maps needs a map centre before anything is displayed

                    //setup map manipulation events
                    this.map.addEventListener(plugin.google.maps.event.CAMERA_MOVE_END, () => {
                        this.events.publish('ocm:mapping:dragend');
                        this.events.publish('ocm:mapping:zoom');
                    });
                });
            } else {
                this.logging.log("Map object is not null at init..");
            }
        } else {
            this.logging.log("No native maps plugin available.");
            this.mapReady = false;
        }
    }

    /**
    * Renders the given array of POIs as map markers
    * @param poiList  array of POI objects
    * @param parentContext  parent app context
    */
    showPOIListOnMap(poiList: Array<any>, parentContext: any) {

        var clearMarkersOnRefresh = false;

        this.map.setVisible(true);

        if (this.markerList != null && this.markerList.size() > this.maxMarkers) {
            //max markers on map, start new batch again 
            this.logging.log("map:max markers. clearing map.");
            this.map.clear();
        }
        this.renderPOIMarkers(clearMarkersOnRefresh, poiList);
    }

    clearMarkers() {
        this.logging.log("map:clearing markers");
        if (this.markerList != null) {
            for (var i = 0; i < this.markerList.size(); i++) {
                if (this.markerList[i] && this.markerList[i] != null) {
                    this.markerList[i].setMap(null);
                }
            }
        }
        this.markerList = new Dictionary<number, any>();
    }

    renderPOIMarkers(clearMarkersOnRefresh: boolean, poiList: Array<any>) {
        var map = this.map;
        var _providerContext = this;
        var bounds = new plugin.google.maps.LatLngBounds();
        var markersAdded = 0;

        //clear existing markers (if enabled)
        if (clearMarkersOnRefresh == true || (this.markerList != null && this.markerList.values.length > this.maxMarkers)) {

            this.clearMarkers();
        }

        if (poiList != null) {
            //render poi markers
            var poiCount = poiList.length;
            for (var i = 0; i < poiList.length; i++) {
                if (poiList[i].AddressInfo != null) {
                    if (poiList[i].AddressInfo.Latitude != null && poiList[i].AddressInfo.Longitude != null) {
                        var poi = poiList[i];

                        var addMarker = true;
                        if (this.markerList != null) {
                            //find if this poi already exists in the marker list
                            if (this.markerList.containsKey(poi.ID)) {
                                addMarker = false;
                            }
                        }

                        if (addMarker) {
                            var poiLevel = Utils.getMaxLevelOfPOI(poi);

                            var iconURL = null;
                            var animation = null;
                            var shadow = null;
                            var markerImg = null;

                            iconURL = window.location.href.replace(/\/([^\/]+)$/, "") +"assets/images/icons/map/level" + poiLevel;

                            if (poi.UsageType != null && poi.UsageType.Title.indexOf("Private") > -1) {
                                iconURL += "_private";
                            } else if (poi.StatusType != null && poi.StatusType.IsOperational != true) {
                                iconURL += "_nonoperational";
                            } else {
                                iconURL += "_operational";
                            }

                            iconURL += "_icon.png";


                            var markerTooltip = "OCM-" + poi.ID + ": " + poi.AddressInfo.Title + ":";
                            if (poi.UsageType != null) markerTooltip += " " + poi.UsageType.Title;
                            if (poiLevel > 0) markerTooltip += " Level " + poiLevel;
                            if (poi.StatusType != null) markerTooltip += " " + poi.StatusType.Title;



                            //cache marker details
                            this.markerList.setValue(poi.ID, poi.ID);
                            this.markerAllocCount++;
                            var newMarker = map.addMarker({
                                'position': { lat: poi.AddressInfo.Latitude, lng: poi.AddressInfo.Longitude },
                                'title': markerTooltip,
                                'snippet': "View details",
                                'iconData': {
                                    'url':  iconURL,
                                    'size': {
                                        'width': 30,
                                        'height': 50
                                    }
                                }
                            }, (marker) => {
                                //show full details when info window tapped
                                //marker.addEventListener(plugin.google.maps.event.INFO_CLICK, function () {
                                marker.addEventListener(plugin.google.maps.event.MARKER_CLICK, function () {
                                    var markerTitle = marker.getTitle();
                                    var poiId = markerTitle.substr(4, markerTitle.indexOf(":") - 4);

                                    if (console) console.log("POI clicked:" + poiId);
                                    _providerContext.events.publish('ocm:poi:selected', { poi: null, poiId: poiId });

                                });


                            });

                            //bounds.extend(markerPos);

                        }
                    }
                }
            }

            this.logging.log(markersAdded + " new map markers added out of a total " + this.markerList.values.length + " [alloc:" + this.markerAllocCount + "]");
        }

        var uiContext = this;
        //zoom to bounds of markers

        this.refreshMapLayout();
    }
    refreshMapLayout() {
        /* if (this.map != null) {
             this.map.refreshLayout();
             this.logging.log("refreshed map layout, focusing map");
             this.focusMap();
         }*/
    }

    setMapCenter(pos: GeoPosition) {
        if (this.mapReady) {
            this.map.setCameraTarget({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        }
    }

    getMapCenter(): Observable<GeoPosition> {

        //wrap getCameraPosition in an observable
        let obs = Observable.create(observer => {
            var result = this.map.getCameraPosition();
            if (result) {
                let geoPos = new GeoPosition(result.target.lat, result.target.lng);
                observer.next(geoPos);
                observer.complete();
            } else {
                //failed to get camera position
            }

        });

        return obs;
    }

    setMapZoom(zoomLevel: number) {
        this.map.setCameraZoom(zoomLevel);
    }


    getMapZoom(): Observable<number> {

        //wrap get zoom in an observable
        let obs = Observable.create(observer => {
            let zoom = this.map.getCameraZoom();
            observer.next(zoom);
            observer.complete();
        });
        return obs;
    }

    setMapType(mapType: string) {
        try {
            this.map.setMapTypeId(eval("google.maps.MapTypeId." + mapType));
        } catch (exception) {
            this.logging.log("Failed to set map type:" + mapType + " : " + exception.toString());
        }
    }

    getMapBounds(): Observable<Array<GeoLatLng>> {

        let obs = Observable.create((observer) => {

            let mapBounds = this.map.getVisibleRegion();

            if (mapBounds != null) {
                var bounds = new Array<GeoLatLng>();
                //this.logging.log(JSON.stringify(mapBounds));
                bounds.push(new GeoLatLng(mapBounds.northeast.lat, mapBounds.northeast.lng));
                bounds.push(new GeoLatLng(mapBounds.southwest.lat, mapBounds.southwest.lng));

                observer.next(bounds);
                observer.complete();
            } else {
                this.logging.log("google maps native: failed to get map bounds");
                observer.error();
            }

        });
        return obs;
    }

    moveToMapBounds(bounds: GeoBounds) {
        alert("move to map bounds not implemented");
        /*this.map.fitBounds(
            new google.maps.LatLngBounds(
                new google.maps.LatLng(bounds.southWest.latitude, bounds.southWest.longitude),
                new google.maps.LatLng(bounds.northEast.latitude, bounds.northEast.longitude))
        );*/
    }

    renderMap(poiList: Array<any>, mapHeight: number, parentContext: any): boolean {

        if (!this.mapReady) {
            this.logging.log("renderMap: skipping render, map not ready yet");
        }

        if (this.map == null) this.logging.log("Native map not initialised");
        if (this.mapCanvasID == null) this.logging.log("mapcanvasid not set!!");

        this.showPOIListOnMap(poiList, parentContext);

        return true;
    }

    renderPolyline(polyline: string) {
        this.clearPolyline();
        //TODO: add polyline
        this.map.addPolyline({
            points: <any>google.maps.geometry.encoding.decodePath(polyline),
            'color': '#AA00FF',
            'width': 10,
            'geodesic': true
        });
    }

    clearPolyline() {
        if (this.polylinePath != null) {
            this.polylinePath.setMap(null);
        }
    }

    unfocusMap() {
        this.map.setClickable(false);
    }

    focusMap() {
        if (this.mapReady) {
            this.map.setClickable(true);
        } else {
            this.logging.log("focus: map not ready..");
        }

    }
}