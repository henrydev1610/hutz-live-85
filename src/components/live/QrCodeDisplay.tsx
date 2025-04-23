import { useRef, useEffect, useState } from "react";
import { useSessionManager } from "@/hooks/useSessionManager";
import { useSettingsStore } from "@/hooks/use-settings-store";
import Draggable from "react-draggable";
import QRCode from "qrcode";

interface QrCodeDisplayProps {
  isPreview?: boolean;
}

const QrCodeDisplay = ({ isPreview = false }: QrCodeDisplayProps) => {
  const { sessionId } = useSessionManager();
  const { qrCode } = useSettingsStore();
  const [qrCodeUrl, setQrCodeUrl] = useState<string>("");
  const qrCodeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (sessionId) {
      const sessionUrl = `${window.location.origin}/participant?sessionId=${sessionId}`;
      
      QRCode.toDataURL(sessionUrl, {
        width: qrCode.size,
        margin: 1,
        color: {
          dark: "#000000",
          light: "#FFFFFF"
        }
      })
        .then(url => {
          setQrCodeUrl(url);
        })
        .catch(err => {
          console.error("Error generating QR code:", err);
        });
    }
  }, [sessionId, qrCode.size]);

  const handleDrag = (_e: any, data: { x: number; y: number }) => {
    if (!isPreview) return;
    // Update position in store if it's the preview
    useSettingsStore.getState().updateQrCode({
      position: { x: data.x, y: data.y }
    });
  };

  if (!qrCodeUrl || !qrCode.isVisible) return null;

  const qrCodeContent = (
    <>
      <img 
        src={qrCodeUrl} 
        alt="QR Code para participar" 
        style={{ width: `${qrCode.size}px`, height: `${qrCode.size}px` }}
      />
      {qrCode.text && (
        <p 
          style={{
            fontFamily: qrCode.fontFamily,
            color: qrCode.textColor,
            textAlign: "center",
            marginTop: "10px"
          }}
        >
          {qrCode.text}
        </p>
      )}
    </>
  );

  // If it's not preview or not draggable, render as static
  if (!isPreview) {
    return (
      <div 
        ref={qrCodeRef}
        className="absolute"
        style={{
          left: `${qrCode.position.x}px`,
          top: `${qrCode.position.y}px`
        }}
      >
        {qrCodeContent}
      </div>
    );
  }

  // Otherwise render as draggable
  return (
    <Draggable
      position={qrCode.position}
      onDrag={handleDrag}
      bounds="parent"
    >
      <div ref={qrCodeRef} className="absolute cursor-move">
        {qrCodeContent}
      </div>
    </Draggable>
  );
};

export default QrCodeDisplay;
