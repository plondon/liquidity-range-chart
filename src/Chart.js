import React, { useEffect, useRef } from 'react';
import { createChart } from 'lightweight-charts';

const Chart = ({ data, liquidityData }) => {
  const chartContainerRef = useRef();
  const chart = useRef();
  const lineSeries = useRef();
  const liquiditySeries = useRef();

  useEffect(() => {
    chart.current = createChart(chartContainerRef.current, {
      width: 800,
      height: 400,
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

  return <div ref={chartContainerRef} style={{ width: '800px', height: '400px' }} />;
};

export default Chart;