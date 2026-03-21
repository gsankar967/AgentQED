"use client";

import { useEffect, useRef } from "react";

function renderFractal(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const width = canvas.width;
  const height = canvas.height;

  const maxIter = 100;
  const centerX = -0.5;
  const centerY = 0;
  const zoom = 3.0;

  const imageData = ctx.createImageData(width, height);
  const data = imageData.data;

  for (let px = 0; px < width; px++) {
    for (let py = 0; py < height; py++) {
      const x0 = centerX + ((px - width / 2) / width) * zoom;
      const y0 = centerY + ((py - height / 2) / height) * zoom;

      let x = 0;
      let y = 0;
      let iter = 0;

      while (x * x + y * y <= 4 && iter < maxIter) {
        const xTemp = x * x - y * y + x0;
        y = 2 * x * y + y0;
        x = xTemp;
        iter++;
      }

      const idx = (py * width + px) * 4;

      if (iter === maxIter) {
        // Inside the Mandelbrot set
        data[idx] = 10;
        data[idx + 1] = 10;
        data[idx + 2] = 18;
        data[idx + 3] = 255;
      } else {
        // Outside — color based on escape speed
        const t = iter / maxIter;

        // Create violet/indigo gradient bands
        const r = Math.floor(15 + 60 * Math.pow(Math.sin(t * Math.PI * 3), 2));
        const g = Math.floor(10 + 20 * Math.pow(Math.sin(t * Math.PI * 2.5), 2));
        const b = Math.floor(25 + 100 * Math.pow(Math.sin(t * Math.PI * 2), 2));

        data[idx] = r;
        data[idx + 1] = g;
        data[idx + 2] = b;
        data[idx + 3] = 255;
      }
    }
  }

  ctx.putImageData(imageData, 0, 0);
}

export default function MathBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Use a lower resolution for performance, CSS scales it up
    const scale = 0.5;
    const width = Math.floor(window.innerWidth * scale);
    const height = Math.floor(window.innerHeight * scale);
    canvas.width = width;
    canvas.height = height;

    renderFractal(canvas);

    const handleResize = () => {
      const w = Math.floor(window.innerWidth * scale);
      const h = Math.floor(window.innerHeight * scale);
      canvas.width = w;
      canvas.height = h;
      renderFractal(canvas);
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        zIndex: 0,
        pointerEvents: "none",
        opacity: 0.3,
      }}
    />
  );
}
