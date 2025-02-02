import { useEffect, useMemo, useState, useRef } from "react";
import { Loader2 } from "lucide-react";
import * as d3 from 'd3';
import { useData } from '../context/DataContext';
import './bubble.css';

interface BitcoinRiskChartProps {
  onBubbleClick: (crypto: any) => void;
  selectedRange: string;
  isCollapsed?: boolean;
}

const CONTAINER_HEIGHT = 600;
const CONTAINER_WIDTH = 1100;

export default function BitcoinRiskChart({ onBubbleClick, selectedRange, isCollapsed }: BitcoinRiskChartProps) {
  const { filteredData, loading, error } = useData();
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(CONTAINER_WIDTH);
  const simulationRef = useRef<d3.Simulation<any, undefined> | null>(null);

  // Handle container width updates
  useEffect(() => {
    const updateWidth = () => {
      console.log("Filtwered Data", filteredData);
      
      if (containerRef.current) {
        const newWidth = containerRef.current.clientWidth - (isCollapsed ? 24 : 48);
        setContainerWidth(newWidth);
      }
    };

    updateWidth();
    const resizeObserver = new ResizeObserver(() => {
      updateWidth();
    });

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, [isCollapsed]);

  const rangeFilteredData = useMemo(() => {
    // If no data or loading, return empty array
    if (!filteredData.length) return [];

    let start = 0;
    let end = 100;

    if (selectedRange !== "Top 100") {
      const [startStr, endStr] = selectedRange.split(" - ");
      start = parseInt(startStr) - 1;
      end = parseInt(endStr);
    }

    return filteredData.slice(Math.max(0, start), Math.min(filteredData.length, end));
  }, [filteredData, selectedRange]);

  const calculateBubbleColor = (risk: number) => {
    if (risk >= 50 && risk <= 55) return 'hsl(0, 0%, 50%)'; // Grey for 50-55
    
    if (risk < 50) {
      // Green gradient: 0 (dark green) -> 50 (light green)
      const intensity = (risk / 50) * 100;
      return `hsl(${120 - (intensity * 0.5)}, ${70 - (intensity * 0.3)}%, ${30 + (intensity * 0.4)}%)`;
    }
    
    // Red gradient: 55 (light red) -> 100 (dark red)
    const intensity = ((risk - 55) / 45) * 100;
    return `hsl(0, ${50 + (intensity * 0.5)}%, ${50 - (intensity * 0.3)}%)`;
  };

  

  // Initialize and update simulation
  useEffect(() => {
    if (!containerRef.current || !rangeFilteredData.length || !containerWidth) {
      // Clear existing visualization if no data
      if (containerRef.current) {
        const container = d3.select(containerRef.current);
        container.selectAll("*").remove();
      }
      return;
    }

    if (simulationRef.current) {
      simulationRef.current.stop();
    }
    

    const container = d3.select(containerRef.current);
    container.selectAll("*").remove();

    const bubbleContainer = container
      .append("div")
      .attr("class", "bubbles-wrapper")
      .style("position", "absolute")
      .style("inset", "0")
      .style("overflow", "visible")
      .style("pointer-events", "none");

    const initializedData = rangeFilteredData.map(d => ({
      ...d,
      x: containerWidth / 2,
      y: CONTAINER_HEIGHT * (1 - d.Risk / 100),
      radius: (d.bubbleSize ? (d.bubbleSize * 48) % 200 : 48) / 2
    }));
    

    const simulation = d3.forceSimulation<any>(initializedData as any)
      .force("x", d3.forceX(containerWidth / 2).strength(0.1))
      .force("y", d3.forceY<any>(d => 
        20 + CONTAINER_HEIGHT * (1 - d.Risk / 100)
      ).strength(1))
      .force("collide", d3.forceCollide().radius(d => ( 24) + 5))
      .force("charge", d3.forceManyBody().strength(-30))
      .alphaDecay(0.01) // Slower decay for smoother animation
      .velocityDecay(0.4); // Adjust for better movement

    simulationRef.current = simulation;

    
    const bubbles = bubbleContainer.selectAll(".bubble-container")
      .data(initializedData)
      .enter()
      .append("div")
      .attr("class", "bubble-container")
      .style("position", "absolute")
      .style("pointer-events", "auto")
      .style("opacity", "0") // Start with opacity 0
      .html(d => `
        <div class="bubble">
          <div class="rounded-full bg-black/20 backdrop-blur-sm shadow-lg transition-transform hover:scale-105"
               style="width: ${d.radius * 2}px; height: ${d.radius * 2}px;  background-color: ${calculateBubbleColor(d.Risk)}">
            <div class="w-full h-full rounded-full bg-gradient-to-br from-white/20 to-transparent" />
          </div>
          <div class="absolute inset-0 flex flex-col items-center justify-center text-center group cursor-pointer">
            ${d.Icon ? `<img src="${d.Icon}" alt="${d.Symbol}" class="w-1/3 h-1/3 object-contain mb-1" loading="lazy" />` : ''}
            <span class="text-xs font-medium text-white">${d.Symbol}</span>
            <span class="text-xs font-bold text-white">${d.Risk?.toFixed(1)}%</span>
          </div>
        </div>
      `)
      .on("click", (_, d) => onBubbleClick(d));

    // Fade in bubbles
    bubbles.transition()
      .duration(500)
      .style("opacity", "1");

    simulation.on("tick", () => {
      bubbles.style("transform", d => `translate(${d.x}px, ${d.y}px)`);
    });

    return () => {
      simulation.stop();
      simulationRef.current = null;
    };
  }, [rangeFilteredData, containerWidth, onBubbleClick]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  // Add check for empty data
  if (!loading && (!filteredData.length || !rangeFilteredData.length)) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-white">No data available for the selected filters</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 p-4">
        <p className="text-red-600">Error loading data: {error}</p>
        <button 
          onClick={() => window.location.reload()} 
          className="mt-2 px-4 py-2 bg-red-100 rounded hover:bg-red-200"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      <div className="relative bg-black" style={{ height: CONTAINER_HEIGHT }}>
        <div className="absolute left-0 top-0 flex flex-col text-sm text-white"
             style={{ width: '30px', height: `${CONTAINER_HEIGHT-50}px` }}>
          {[100, 80, 60, 40, 20, 0].map(level => (
            <span 
              key={level}
              className="absolute text-xs"
              style={{ 
                top: `${CONTAINER_HEIGHT - (level / 100) * CONTAINER_HEIGHT}px`,
                transform: 'translateY(-10%)'
              }}
            >
              {level} -
            </span>
          ))}
        </div>

        <div className="absolute left-8 top-2 text-lg font-semibold text-white">Risk Levels</div>
        <div className="absolute bottom-2 right-4 text-emerald-300 font-medium">UNDERVALUED</div>
        <div className="absolute top-2 right-4 text-red-300 font-medium">OVERVALUED</div>

        <div 
          ref={containerRef}
          className="custom-div ml-7" 
          style={{ 
            position: 'relative',
            height: `${CONTAINER_HEIGHT}px`,
          }}
        />
      </div>
    </div>
  );
}