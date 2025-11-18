import React, { useRef, useState, useCallback } from 'react';
import styled from 'styled-components';

const KnobContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
`;

const KnobSvg = styled.svg`
  cursor: pointer;
  user-select: none;
`;

const KnobLabel = styled.span`
  font-size: 9px;
  color: #666;
  font-weight: bold;
  text-transform: uppercase;
`;

interface KnobProps {
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  label?: string;
  size?: number;
}

export const Knob: React.FC<KnobProps> = ({
  value,
  min,
  max,
  onChange,
  label,
  size = 40,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const startYRef = useRef(0);
  const startValueRef = useRef(0);

  const normalizedValue = (value - min) / (max - min);
  const angle = -135 + normalizedValue * 270; // -135deg to +135deg range

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setIsDragging(true);
    startYRef.current = e.clientY;
    startValueRef.current = value;
    e.preventDefault();
  }, [value]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return;

    const deltaY = startYRef.current - e.clientY;
    const range = max - min;
    const sensitivity = 0.5; // Adjust sensitivity
    const delta = (deltaY / 100) * range * sensitivity;

    const newValue = Math.max(min, Math.min(max, startValueRef.current + delta));
    onChange(newValue);
  }, [isDragging, min, max, onChange]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  React.useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
    return undefined;
  }, [isDragging, handleMouseMove, handleMouseUp]);

  const radius = size / 2 - 4;
  const centerX = size / 2;
  const centerY = size / 2;

  // Calculate indicator position
  const indicatorAngle = (angle * Math.PI) / 180;
  const indicatorX = centerX + Math.cos(indicatorAngle) * (radius - 6);
  const indicatorY = centerY + Math.sin(indicatorAngle) * (radius - 6);

  return (
    <KnobContainer>
      <KnobSvg
        width={size}
        height={size}
        onMouseDown={handleMouseDown}
      >
        {/* Outer circle */}
        <circle
          cx={centerX}
          cy={centerY}
          r={radius}
          fill="#f5f5f5"
          stroke="#999"
          strokeWidth="2"
        />

        {/* Arc showing value */}
        <path
          d={`M ${centerX + Math.cos(-2.356) * radius} ${centerY + Math.sin(-2.356) * radius}
              A ${radius} ${radius} 0 ${normalizedValue > 0.5 ? 1 : 0} 1
              ${centerX + Math.cos(-2.356 + normalizedValue * 4.712) * radius}
              ${centerY + Math.sin(-2.356 + normalizedValue * 4.712) * radius}`}
          fill="none"
          stroke={isDragging ? '#3b82f6' : '#666'}
          strokeWidth="3"
          strokeLinecap="round"
        />

        {/* Indicator dot */}
        <circle
          cx={indicatorX}
          cy={indicatorY}
          r="3"
          fill={isDragging ? '#3b82f6' : '#333'}
        />
      </KnobSvg>
      {label && <KnobLabel>{label}</KnobLabel>}
    </KnobContainer>
  );
};
