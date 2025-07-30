import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

interface BannerLogoSvgProps {
  width?: number;
  height?: number;
  color?: string;
}

export default function BannerLogoSvg({ 
  width = 200, 
  height = 80, 
  color = '#007AFF' 
}: BannerLogoSvgProps) {
  return (
    <View style={styles.container}>
      <Svg width={width} height={height} viewBox="0 0 200 80">
        {/* Example logo - replace with your actual SVG paths */}
        <Circle
          cx="40"
          cy="40"
          r="30"
          stroke={color}
          strokeWidth="3"
          fill="none"
        />
        <Rect
          x="80"
          y="20"
          width="40"
          height="40"
          stroke={color}
          strokeWidth="3"
          fill="none"
        />
        <Path
          d="M140 20 L180 40 L140 60 Z"
          stroke={color}
          strokeWidth="3"
          fill="none"
        />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});