import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { Loader2, AlertTriangle } from "lucide-react";
import * as d3 from 'd3';
import { useData } from '../context/DataContext';
import './bubble.css';
import { motion, AnimatePresence } from 'framer-motion';

interface BitcoinRiskChartProps {
  onBubbleClick: (crypto: any) => void;
  selectedRange: string;
  isCollapsed?: boolean;
}

const BitcoinRiskChart = ({ onBubbleClick, selectedRange, isCollapsed }: BitcoinRiskChartProps) => {
  const { filteredData, loading, error } = useData();
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);
  const simulationRef = useRef<d3.Simulation<any, undefined> | null>(null);
  const [hoveredBubble, setHoveredBubble] = useState<string | null>(null);

  // Responsive container setup
  const updateDimensions = useCallback(() => {
    if (containerRef.current) {
      const width = containerRef.current.clientWidth - (isCollapsed ? 24 : 48);
      const height = window.innerHeight * 0.7; // 70% of viewport height
      setContainerWidth(width);
      setContainerHeight(height);
    }
  }, [isCollapsed]);

  useEffect(() => {
    updateDimensions();
    const resizeObserver = new ResizeObserver(updateDimensions);

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    window.addEventListener('resize', updateDimensions);
    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', updateDimensions);
    };
  }, [updateDimensions]);

  const rangeFilteredData = useMemo(() => {
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

  const calculateBubbleColor = useCallback((risk: number) => {
    if (risk >= 50 && risk <= 55) return 'hsl(0, 0%, 10%)';
    
    if (risk < 50) {
      const intensity = (risk / 50) * 100;
      return `hsl(${120 - (intensity * 0.5)}, ${70 - (intensity * 0.3)}%, ${30 + (intensity * 0.4)}%)`;
    }
    
    const intensity = ((risk - 55) / 45) * 100;
    return `hsl(0, ${50 + (intensity * 0.5)}%, ${50 - (intensity * 0.3)}%)`;
  }, []);

  const getRiskBand = useCallback((risk: number) => {
    const bandPadding = containerHeight * 0.05;
    if (risk >= 80) return containerHeight * 0.1 + bandPadding;
    if (risk >= 60) return containerHeight * 0.3 + bandPadding;
    if (risk >= 40) return containerHeight * 0.5 + bandPadding;
    if (risk >= 20) return containerHeight * 0.7 + bandPadding;
    return containerHeight * 0.9 - bandPadding;
  }, [containerHeight]);

  useEffect(() => {
    if (!containerRef.current || !rangeFilteredData.length || !containerWidth || !containerHeight) {
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
      .attr("class", "bubbles-wrapper");

    const initializedData = rangeFilteredData.map(d => ({
      ...d,
      x: containerWidth / 2 + (Math.random() - 0.5) * containerWidth * 0.6,
      y: getRiskBand(d.risk || 0),
      radius: Math.max(
        20,
        Math.min(30, d.bubbleSize ? d.bubbleSize * 25 : 30)
      ) * (containerWidth < 640 ? 0.7 : 1) // Smaller bubbles on mobile
    }));

    const simulation = d3.forceSimulation<any>(initializedData)
      .force("x", d3.forceX(d => {
        const index = initializedData.indexOf(d as any);
        const spread = containerWidth * 0.4;
        const offset = (index / initializedData.length - 0.5) * spread;
        return containerWidth / 2 + offset;
      }).strength(0.08))
      .force("y", d3.forceY(d => getRiskBand(d.risk || 50)).strength(0.5))
      .force("collide", d3.forceCollide().radius(d => d.radius + 3).strength(0.8))
      .force("charge", d3.forceManyBody().strength(-40))
      .alphaDecay(0.02)
      .velocityDecay(0.3);

    simulationRef.current = simulation;

    const bubbles = bubbleContainer.selectAll(".bubble-container")
      .data(initializedData)
      .enter()
      .append("div")
      .attr("class", "bubble-container")
      .style("opacity", "0")
      .html(d => `
        <div class="bubble">
          <div class="rounded-full backdrop-blur-sm shadow-lg transition-transform hover:scale-105"
               style="width: ${d.radius * 2}px; height: ${d.radius * 2}px; background-color: ${calculateBubbleColor(d.risk)}">
            <div class="w-full h-full rounded-full bg-gradient-to-br from-white/20 to-transparent" />
          </div>
          <div class="absolute inset-0 flex flex-col items-center justify-center text-center group cursor-pointer">
            ${d.icon ? `<img src="${d.icon}" alt="${d.symbol}" class="w-1/3 h-1/3 object-contain mb-1" loading="lazy" />` : ''}
            <span class="text-xs font-medium text-white">${d.symbol}</span>
            <span class="text-xs font-bold text-white">${d.risk?.toFixed(1)}%</span>
          </div>
        </div>
      `)
      .on("click", (_, d) => onBubbleClick(d))
      .on("mouseenter", (_, d) => setHoveredBubble(d.symbol))
      .on("mouseleave", () => setHoveredBubble(null));

    // Enhanced tooltip using Framer Motion
    bubbleContainer
      .selectAll(".bubble-container")
      .append("div")
      .attr("class", "tooltip")
      .style("position", "absolute")
      .style("pointer-events", "none")
      .style("z-index", 1000)
      .style("opacity", 0)
      .html(d => `
        <div class="bg-gray-800 text-white p-2 rounded shadow-lg text-sm">
          <div class="font-bold">${d.symbol}</div>
          <div>Risk: ${d.risk.toFixed(1)}%</div>
          <div>Volume: $${(d.volume || 0).toLocaleString()}</div>
        </div>
      `);

    // Fade in bubbles with stagger
    bubbles.each((d, i, nodes) => {
      d3.select(nodes[i])
        .transition()
        .delay(i * 50)
        .duration(500)
        .style("opacity", "0.9");
    });

    simulation.on("tick", () => {
      bubbles
        .style("left", d => `${Math.max(d.radius, Math.min(containerWidth - d.radius, d.x))}px`)
        .style("top", d => `${Math.max(d.radius, Math.min(containerHeight - d.radius, d.y))}px`)
        .style("transform", "translate(-50%, -50%)");
    });

    return () => {
      simulation.stop();
      simulationRef.current = null;
    };
  }, [rangeFilteredData, containerWidth, containerHeight, onBubbleClick, calculateBubbleColor, getRiskBand]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (!loading && (!filteredData.length || !rangeFilteredData.length)) {
    return (
      <div className="flex flex-col items-center justify-center h-96 text-center px-4">
        <AlertTriangle className="w-12 h-12 text-yellow-500 mb-4" />
        <p className="text-white text-lg">No data available for the selected filters</p>
        <p className="text-gray-400 mt-2">Try adjusting your filter settings or selecting a different range</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-96 bg-red-50/10 p-4 rounded-lg">
        <AlertTriangle className="w-12 h-12 text-red-500 mb-4" />
        <p className="text-red-400 text-lg mb-4">Error loading data: {error}</p>
        <button 
          onClick={() => window.location.reload()} 
          className="px-6 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      <div className="relative bg-black" style={{ height: containerHeight }}>
        {/* Risk Level Labels */}
        <div className="absolute left-0 top-0 flex flex-col text-sm text-white"
             style={{ width: '30px', height: `${containerHeight-50}px` }}>
          {[100, 80, 60, 40, 20, 0].map(level => (
            <div 
              key={level}
              className="absolute w-full"
              style={{ 
                top: `${containerHeight * (1 - level / 100)}px`,
                transform: 'translateY(-10%)'
              }}
            >
              <span className="text-xs">{level} -</span>
              {level > 0 && (
                <div 
                  className="absolute w-[calc(100vw-32px)] h-[1px] left-[30px]" 
                  style={{
                    backgroundColor: 'rgba(255,255,255,0.1)',
                    zIndex: 1
                  }}
                />
              )}
            </div>
          ))}
        </div>

        {/* Chart Labels */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute left-10 top-2 text-lg font-semibold z-10 text-white"
        >
          Risk Levels
        </motion.div>
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="absolute bottom-2 right-10 text-white z-50 font-medium"
        >
          UNDERVALUED
        </motion.div>
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="absolute top-2 right-10 text-white z-50 font-medium"
        >
          OVERVALUED
        </motion.div>

        {/* Main Chart Container */}
        <div 
          ref={containerRef}
          className="custom-div ml-7" 
          style={{ 
            position: 'relative',
            height: `${containerHeight}px`,
            padding: '20px 0'
          }}
        />

        {/* Tooltips */}
        <AnimatePresence>
          {hoveredBubble && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="absolute pointer-events-none z-[1000]"
              style={{
                left: '50%',
                bottom: '20px',
                transform: 'translateX(-50%)'
              }}
            >
              <div className="bg-gray-800 text-white px-4 py-2 rounded-lg shadow-lg">
                {hoveredBubble}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default BitcoinRiskChart;