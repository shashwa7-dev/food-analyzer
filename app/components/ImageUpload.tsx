import React, { useState } from "react";
import { CloudArrowUpIcon } from "@heroicons/react/24/outline";

interface ImageUploadProps {
  onImageUpload: (file: File) => void;
}

const ImageUpload: React.FC<ImageUploadProps> = ({ onImageUpload }) => {
  const [dragActive, setDragActive] = useState(false);

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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      onImageUpload(e.target.files[0]);
    }
  };

  return (
    <div
      className={`flex items-center justify-center w-rounded-lg p-12 relativ`}
      onDragEnter={handleDrag}
      onDragLeave={handleDrag}
      onDragOver={handleDrag}
      onDrop={handleDrop}
    >
      <label
        htmlFor="dropzone-file"
        className="flex flex-col items-center justify-center w-full h-full cursor-pointer text-center"
      >
        <img src={"./qr-code.png"} className="w-20 h-20" />
        <p className="mt-2 text-sm text-secondary font-semibold">
          Upload the side with ingredients and nutrition details.
        </p>
        <p className="text-xs text-gray-400">
          Using Gemini Flash 1.5 results may be inaccurate.
        </p>
      </label>
      <input
        id="dropzone-file"
        type="file"
        className="hidden"
        onChange={handleChange}
        accept="image/*"
      />
    </div>
  );
};

export default ImageUpload;
