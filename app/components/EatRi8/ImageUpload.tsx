import {
  Aperture,
  Camera,
  CameraOff,
  CloudUpload,
  SwitchCamera,
} from "lucide-react";
import React, { useState, useRef, useCallback } from "react";

interface ImageUploadProps {
  onImageUpload: (file: File) => void;
}

const ImageUpload: React.FC<ImageUploadProps> = ({ onImageUpload }) => {
  const [dragActive, setDragActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [facingMode, setFacingMode] = useState<"user" | "environment">(
    "environment"
  ); // Manage camera facing mode
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      onImageUpload(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      onImageUpload(e.target.files[0]);
    }
  };

  const openFileInput = () => {
    fileInputRef.current?.click();
  };

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode }, // Use the selected facing mode
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }

      setCameraError(null);
      setIsCameraActive(true);
    } catch (err) {
      console.error("Camera access error:", err);
      setCameraError(
        err instanceof DOMException && err.name === "NotAllowedError"
          ? "Camera access was denied. Please check your permissions."
          : "Unable to access camera. Please try file upload."
      );
      setIsCameraActive(false);
    }
  }, [facingMode]);

  const closeCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop()); // Stop all tracks
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
  };

  const toggleCameraFacingMode = () => {
    setFacingMode((prevMode) => (prevMode === "user" ? "environment" : "user"));
  };

  const captureImage = () => {
    if (videoRef.current) {
      const canvas = document.createElement("canvas");
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;

      const context = canvas.getContext("2d");
      context?.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);

      canvas.toBlob((blob) => {
        if (blob) {
          const file = new File([blob], "captured-image.jpg", {
            type: "image/jpeg",
          });
          onImageUpload(file);
        }
      }, "image/jpeg");
    }
  };

  return (
    <div className="w-full rounded-lg shadow-md p-1 bg-card">
      {cameraError && (
        <div className="text-destructive text-sm mb-2 text-center">
          {cameraError}
        </div>
      )}

      {/* Camera Preview */}
      {!cameraError && (
        <div
          className={`flex flex-col items-center justify-center w-full rounded-lg`}
        >
          <video
            ref={videoRef}
            className={`w-full bg-health-poor aspect-video object-cover rounded-lg ${
              isCameraActive ? "" : "hidden"
            }`}
          />
        </div>
      )}

      {!isCameraActive && (
        <div
          className={`flex flex-col h-64 items-center justify-center w-full rounded-lg p-6 border-2 ${
            dragActive
              ? "border-primary bg-primary/10"
              : "border-dashed border-border"
          }`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <div className="flex flex-col items-center text-center">
            <img src="./qr-code.png" className="w-20 h-20 mb-4" alt="Upload" />

            <p className="text-sm font-semibold mb-2">
              Upload the side with ingredients and nutrition details
            </p>

            <p className="text-xs text-muted-foreground mb-4">
              Using Gemini Flash 1.5 results may be inaccurate
            </p>

            <div className="flex gap-2">
              <button
                onClick={startCamera}
                className="btn btn-outline btn-primary flex items-center hover:font-medium text-sm border p-1 px-2 rounded-lg gap-1 bg-primary text-primary-foreground"
              >
                <Camera className="w-5 h-5" />
                Use Camera
              </button>
              <button
                onClick={openFileInput}
                className="btn btn-outline btn-primary flex items-center hover:font-medium text-sm border p-1 px-2 rounded-lg gap-1 bg-health-poor text-primary-foreground"
              >
                <CloudUpload className="w-5 h-5" />
                Upload File
              </button>
            </div>

            <input
              ref={fileInputRef}
              id="dropzone-file"
              type="file"
              className="hidden"
              onChange={handleFileChange}
              accept="image/*"
            />
          </div>
        </div>
      )}

      {isCameraActive && (
        <div className="mt-1 p-2.5 rounded-lg gap-4 bg-primary text-primary-foreground grid grid-cols-3">
          <button
            onClick={captureImage}
            className="btn btn-primary w-full flex justify-center items-center gap-1 text-sm"
          >
            <Aperture className="w-4 h-4" />
            Capture
          </button>
          <button
            onClick={toggleCameraFacingMode}
            className="btn btn-primary w-full flex  justify-center items-center gap-1 text-sm"
          >
            <SwitchCamera className="w-4 h-4" />
            Switch
          </button>
          <button
            onClick={closeCamera}
            className="btn btn-primary w-full justify-center flex items-center gap-1 text-sm"
          >
            <CameraOff className="w-4 h-4" />
            Close
          </button>
        </div>
      )}
    </div>
  );
};

export default ImageUpload;
