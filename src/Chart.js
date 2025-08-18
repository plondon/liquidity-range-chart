import React, { useEffect, useRef, useState } from 'react';
import { createChart } from 'lightweight-charts';

const Chart = ({ data, liquidityData }) => {
  const chartContainerRef = useRef();
  const chart = useRef();
  const lineSeries = useRef();
  const liquiditySeries = useRef();
  const [dimensions, setDimensions] = useState(() => {
    // Initialize with viewport-based dimensions
    const isMobile = window.innerWidth <= 768;
    return {
      width: Math.max(300, Math.min(window.innerWidth - 40, 800)),
      height: isMobile ? Math.min(300, window.innerHeight * 0.4) : 400
    };
  });

  // Handle resize for responsiveness
  useEffect(() => {
    const handleResize = () => {
      // Always calculate based on window size for immediate responsiveness
      const isMobile = window.innerWidth <= 768;
      const height = isMobile ? Math.min(300, window.innerHeight * 0.4) : 400;
      const width = Math.max(300, Math.min(window.innerWidth - 40, isMobile ? window.innerWidth - 40 : 800));
      
      setDimensions(prev => {
        // Only update if dimensions actually changed to avoid unnecessary re-renders
        if (prev.width !== width || prev.height !== height) {
          return { width, height };
        }
        return prev;
      });
    };

    // Use a timeout to ensure DOM is ready
    const timeoutId = setTimeout(handleResize, 100);
    
    window.addEventListener('resize', handleResize);
    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  useEffect(() => {
    if (chart.current) {
      chart.current.applyOptions({
        width: dimensions.width,
        height: dimensions.height
      });
    }
  }, [dimensions]);

  useEffect(() => {
    chart.current = createChart(chartContainerRef.current, {
      width: dimensions.width,
      height: dimensions.height,
      layout: {
        background: {
          color: '#ffffff',
        },
        textColor: '#333333',
      },
      grid: {
        vertLines: {
          color: '#f0f0f0',
        },
        horzLines: {
          color: '#f0f0f0',
        },
      },
      crosshair: {
        mode: 0,
      },
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: true,
      },
      handleScale: {
        axisPressedMouseMove: true,
        mouseWheel: true,
        pinch: true,
      },
      rightPriceScale: {
        borderColor: '#cccccc',
        scaleMargins: {
          top: 0.1,
          bottom: 0.1,
        },
        priceFormat: {
          type: 'price',
          precision: 2,
          minMove: 0.01,
        },
      },
      leftPriceScale: {
        borderColor: '#cccccc',
        scaleMargins: {
          top: 0.1,
          bottom: 0.1,
        },
        priceFormat: {
          type: 'price',
          precision: 8,
          minMove: 0.00000001,
        },
      },
      timeScale: {
        borderColor: '#cccccc',
      },
    });

    lineSeries.current = chart.current.addLineSeries({
      color: '#2196F3',
      lineWidth: 2,
      priceScaleId: 'left',
    });

    liquiditySeries.current = chart.current.addHistogramSeries({
      color: '#FF6B35',
      priceFormat: {
        type: 'volume',
      },
      priceScaleId: 'right',
    });

    return () => chart.current.remove();
  }, []);

  useEffect(() => {
    if (lineSeries.current && data) {
      lineSeries.current.setData(data);
    }
  }, [data]);

  useEffect(() => {
    if (liquiditySeries.current && liquidityData && data && data.length > 0) {
      const lastTime = data[data.length - 1].time;
      const liquidityPoints = liquidityData.map((item, index) => ({
        time: lastTime + index + 1,
        value: item.price0,
        color: '#FF6B35'
      }));
      liquiditySeries.current.setData(liquidityPoints);
    }
  }, [liquidityData, data]);

  return (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'center', 
      width: '100%',
      margin: '0 auto'
    }}>
      <div 
        ref={chartContainerRef} 
        style={{ 
          width: dimensions.width + 'px',
          height: dimensions.height + 'px',
          minWidth: '300px',
          maxWidth: '100%',
          touchAction: 'manipulation' // Optimizes for touch interactions
        }} 
      />
    </div>
  );
};

export default Chart;