import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Delivery } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Navigation, Phone, MapPin } from 'lucide-react';
import { useTranslation } from 'react-i18next';

// Fix default marker icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface DeliveryMapProps {
  deliveries: Delivery[];
  currentLocation?: { lat: number; lng: number };
  onDeliverySelect?: (delivery: Delivery) => void;
}

export function DeliveryMap({ deliveries, currentLocation, onDeliverySelect }: DeliveryMapProps) {
  const { t } = useTranslation();
  const [deliveryLocations, setDeliveryLocations] = useState<Array<{ delivery: Delivery; lat: number; lng: number }>>([]);
  // Initialize with currentLocation or default location (Bamako, Mali)
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(
    currentLocation || { lat: 12.6392, lng: -8.0029 }
  );
  const [geocoding, setGeocoding] = useState(false);
  const [geocodingError, setGeocodingError] = useState(false);

  useEffect(() => {
    // Get current user location
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        (error) => {
          console.error('Error getting location:', error);
          // Set default location if geolocation fails
          setUserLocation(prev => prev || { lat: 12.6392, lng: -8.0029 }); // Default to Bamako, Mali
        }
      );
    } else {
      // Set default location if geolocation is not available
      setUserLocation(prev => prev || { lat: 12.6392, lng: -8.0029 }); // Default to Bamako, Mali
    }
  }, []);

  useEffect(() => {
    // Geocode delivery addresses when deliveries change
    if (deliveries.length > 0) {
      geocodeDeliveries();
    } else {
      setDeliveryLocations([]);
      setGeocoding(false);
      setGeocodingError(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deliveries]);

  const geocodeDeliveries = async () => {
    setGeocoding(true);
    setGeocodingError(false);

    try {
      // Use a geocoding service (OpenStreetMap Nominatim is free)
      // Add a timeout to prevent hanging
      const geocodeWithTimeout = (address: string, timeout = 5000) => {
        return Promise.race([
          fetch(
            `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`,
            {
              headers: {
                'User-Agent': 'RetailManager/1.0' // Required by Nominatim
              }
            }
          ).then(res => res.json()),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Geocoding timeout')), timeout)
          )
        ]);
      };

      const locations = await Promise.all(
        deliveries.map(async (delivery) => {
          try {
            const data = await geocodeWithTimeout(delivery.delivery_address);
            if (data && data.length > 0) {
              return {
                delivery,
                lat: parseFloat(data[0].lat),
                lng: parseFloat(data[0].lon),
              };
            }
          } catch (error) {
            console.error('Geocoding error for', delivery.delivery_address, error);
          }
          return null;
        })
      );

      const validLocations = locations.filter(Boolean) as Array<{ delivery: Delivery; lat: number; lng: number }>;
      setDeliveryLocations(validLocations);
      
      if (validLocations.length === 0 && deliveries.length > 0) {
        setGeocodingError(true);
      }
    } catch (error) {
      console.error('Geocoding failed:', error);
      setGeocodingError(true);
    } finally {
      setGeocoding(false);
    }
  };

  const openNavigation = (delivery: Delivery) => {
    // Open in navigation app (Google Maps, Apple Maps, etc.)
    const url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(delivery.delivery_address)}`;
    window.open(url, '_blank');
  };

  // Determine map center
  const center = userLocation || (deliveryLocations.length > 0 
    ? { lat: deliveryLocations[0].lat, lng: deliveryLocations[0].lng }
    : { lat: 12.6392, lng: -8.0029 }); // Default to Bamako, Mali

  // Show loading only if we're actively geocoding and have no locations yet AND no user location
  if (geocoding && deliveryLocations.length === 0 && !userLocation) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <p className="text-muted-foreground">{t('deliverer.map.loadingMap')}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="w-full h-[500px] rounded-lg overflow-hidden border relative">
      {geocoding && (
        <div className="absolute top-2 right-2 z-[1000] bg-background/80 backdrop-blur-sm px-3 py-1 rounded-md text-sm">
          {t('deliverer.map.loadingLocations')}
        </div>
      )}
      {geocodingError && deliveryLocations.length === 0 && deliveries.length > 0 && (
        <div className="absolute top-2 right-2 z-[1000] bg-yellow-500/80 backdrop-blur-sm px-3 py-1 rounded-md text-sm text-yellow-900">
          {t('deliverer.map.geocodingError')}
        </div>
      )}
      {deliveries.length === 0 && (
        <div className="absolute top-2 right-2 z-[1000] bg-background/80 backdrop-blur-sm px-3 py-1 rounded-md text-sm">
          {t('deliverer.map.noDeliveries')}
        </div>
      )}
      <MapContainer
        center={[center.lat, center.lng]}
        zoom={deliveryLocations.length > 0 ? 13 : 10}
        style={{ height: '100%', width: '100%' }}
        key={`map-${deliveryLocations.length}-${userLocation?.lat}`} // Force re-render when locations change
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* User location marker */}
        {userLocation && (
          <Marker position={[userLocation.lat, userLocation.lng]}>
            <Popup>{t('deliverer.map.yourLocation')}</Popup>
          </Marker>
        )}

        {/* Delivery location markers */}
        {deliveryLocations.map(({ delivery, lat, lng }) => (
          <Marker key={delivery.id} position={[lat, lng]}>
            <Popup>
              <div className="space-y-2">
                <p className="font-semibold">{delivery.customer_name}</p>
                <p className="text-sm">{delivery.delivery_address}</p>
                <p className="text-sm">{delivery.customer_phone}</p>
                <div className="flex gap-2 mt-2">
                  <Button
                    size="sm"
                    onClick={() => openNavigation(delivery)}
                  >
                    <Navigation className="h-3 w-3 mr-1" />
                    {t('deliverer.map.navigate')}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => window.location.href = `tel:${delivery.customer_phone}`}
                  >
                    <Phone className="h-3 w-3 mr-1" />
                    {t('deliverer.map.call')}
                  </Button>
                  {onDeliverySelect && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onDeliverySelect(delivery)}
                    >
                      {t('deliverer.map.viewDetails')}
                    </Button>
                  )}
                </div>
              </div>
            </Popup>
          </Marker>
        ))}

        {/* Route polyline (optional - requires route calculation) */}
        {userLocation && deliveryLocations.length > 0 && (
          <Polyline
            positions={[
              [userLocation.lat, userLocation.lng] as [number, number],
              ...deliveryLocations.map(({ lat, lng }) => [lat, lng] as [number, number]),
            ]}
            color="blue"
            weight={3}
          />
        )}
      </MapContainer>
    </div>
  );
}
