import { useState, useEffect } from 'react';
import { RoutineModelState } from '../types';
import { getMarginalDist } from '../routine/MarkovRoutineModel';
import { HEATMAP_REFRESH_INTERVAL_MS } from '../constants';

export function useRoutineModel(modelState: RoutineModelState) {
  const [heatmapData, setHeatmapData] = useState<number[][]>([]);

  useEffect(() => {
    const computeHeatmap = () => {
      const data: number[][] = [];
      for (let bin = 0; bin < 48; bin++) {
        const dist = getMarginalDist(modelState, bin);
        data.push(Array.from(dist));
      }
      setHeatmapData(data);
    };

    computeHeatmap();

    const interval = setInterval(computeHeatmap, HEATMAP_REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [modelState]);

  return heatmapData;
}
