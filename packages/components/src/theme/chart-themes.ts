/**
 * ECharts Accessible Color Themes - Light & Dark Versions
 *
 * Imported from canvas-ai-compute-studio with accessibility optimizations.
 * Each theme optimized for both light and dark environments.
 */

export interface ChartTheme {
  name: string;
  description: string;
  color: string[];
  backgroundColor: string;
  textStyle: {
    color: string;
    fontWeight: string | number;
  };
  grid: {
    backgroundColor: string;
    borderColor: string;
  };
}

export const chartThemes = {
  // Theme 1: High Contrast Professional
  highContrastLight: {
    name: "High Contrast Light",
    description: "Maximum contrast for light backgrounds",
    color: [
      '#000000', // Black
      '#1A1A1A', // Very Dark Gray
      '#FF4500', // Red Orange
      '#0047AB', // Deep Blue
      '#228B22', // Forest Green
      '#FF8C00', // Dark Orange
      '#8B008B', // Dark Magenta
      '#2F4F4F', // Dark Slate Gray
      '#B22222', // Fire Brick
      '#4B0082'  // Indigo
    ],
    backgroundColor: '#FFFFFF',
    textStyle: {
      color: '#000000',
      fontWeight: 'bold'
    },
    grid: {
      backgroundColor: 'transparent',
      borderColor: '#E0E0E0'
    }
  },

  highContrastDark: {
    name: "High Contrast Dark",
    description: "Maximum contrast for dark backgrounds",
    color: [
      '#FFFFFF', // White
      '#F0F0F0', // Light Gray
      '#FF6347', // Tomato
      '#00BFFF', // Deep Sky Blue
      '#32CD32', // Lime Green
      '#FFD700', // Gold
      '#FF69B4', // Hot Pink
      '#87CEEB', // Sky Blue
      '#FFA500', // Orange
      '#DA70D6'  // Orchid
    ],
    backgroundColor: 'transparent',
    textStyle: {
      color: '#FFFFFF',
      fontWeight: 'bold'
    },
    grid: {
      backgroundColor: 'transparent',
      borderColor: '#404040'
    }
  },

  // Theme 2: Colorblind Safe (Okabe-Ito Palette)
  colorblindSafeLight: {
    name: "Universal Light",
    description: "Colorblind-safe palette for light backgrounds",
    color: [
      '#E69F00', // Orange
      '#56B4E9', // Sky Blue
      '#009E73', // Bluish Green
      '#0072B2', // Blue
      '#D55E00', // Vermillion
      '#CC79A7', // Reddish Purple
      '#000000', // Black
      '#F0E442', // Yellow (moved later for better contrast)
      '#999999', // Gray
      '#654321'  // Dark Brown
    ],
    backgroundColor: '#FEFEFE',
    textStyle: {
      color: '#2C2C2C',
      fontWeight: '500'
    },
    grid: {
      backgroundColor: 'transparent',
      borderColor: '#E8E8E8'
    }
  },

  colorblindSafeDark: {
    name: "Universal Dark",
    description: "Colorblind-safe palette for dark backgrounds",
    color: [
      '#FFB347', // Light Orange
      '#87CEEB', // Light Sky Blue
      '#66CDAA', // Medium Aquamarine
      '#4A9EFF', // Bright Blue
      '#FF7F50', // Coral
      '#DDA0DD', // Plum
      '#F0F0F0', // Light Gray
      '#FFFF99', // Light Yellow
      '#C0C0C0', // Silver
      '#D2B48C'  // Tan
    ],
    backgroundColor: 'transparent',
    textStyle: {
      color: '#E0E0E0',
      fontWeight: '500'
    },
    grid: {
      backgroundColor: 'transparent',
      borderColor: '#404040'
    }
  },

  // Theme 3: Monochromatic Blue Scale
  oceanDepthsLight: {
    name: "Ocean Depths Light",
    description: "Blue monochromatic scale for light backgrounds",
    color: [
      '#08306B', // Darkest Navy
      '#2171B5', // Dark Blue
      '#4292C6', // Medium Blue
      '#6BAED6', // Steel Blue
      '#08519C', // Dark Blue variant
      '#3182BD', // Medium Blue variant
      '#FF6B35', // Accent Orange
      '#E31A1C', // Accent Red
      '#FF7F00', // Accent Orange-Red
      '#1F77B4'  // Chart Blue
    ],
    backgroundColor: '#FDFDFD',
    textStyle: {
      color: '#08306B',
      fontWeight: '500'
    },
    grid: {
      backgroundColor: 'transparent',
      borderColor: '#DEEBF7'
    }
  },

  oceanDepthsDark: {
    name: "Ocean Depths Dark",
    description: "Blue monochromatic scale for dark backgrounds",
    color: [
      '#9ECAE1', // Light Blue
      '#C6DBEF', // Very Light Blue
      '#DEEBF7', // Pale Blue
      '#6BAED6', // Medium Light Blue
      '#4292C6', // Medium Blue
      '#74C2E1', // Sky Blue
      '#FFB347', // Accent Light Orange
      '#FF6B6B', // Accent Light Red
      '#FFA07A', // Light Salmon
      '#87CEEB'  // Sky Blue variant
    ],
    backgroundColor: 'transparent',
    textStyle: {
      color: '#E8F4F8',
      fontWeight: '500'
    },
    grid: {
      backgroundColor: 'transparent',
      borderColor: '#2C3E50'
    }
  },

  // Theme 4: Earth Tones
  earthTonesLight: {
    name: "Natural Elements Light",
    description: "Earth-inspired colors for light backgrounds",
    color: [
      '#8B4513', // Saddle Brown
      '#228B22', // Forest Green
      '#B8860B', // Dark Goldenrod
      '#2F4F4F', // Dark Slate Gray
      '#A0522D', // Sienna
      '#556B2F', // Dark Olive Green
      '#8B008B', // Dark Magenta
      '#B22222', // Fire Brick
      '#CD853F', // Peru
      '#483D8B'  // Dark Slate Blue
    ],
    backgroundColor: '#FAF7F2',
    textStyle: {
      color: '#2F1B14',
      fontWeight: '500'
    },
    grid: {
      backgroundColor: 'transparent',
      borderColor: '#E8E0D6'
    }
  },

  earthTonesDark: {
    name: "Natural Elements Dark",
    description: "Earth-inspired colors for dark backgrounds",
    color: [
      '#D2B48C', // Tan
      '#90EE90', // Light Green
      '#F0E68C', // Khaki
      '#87CEEB', // Sky Blue
      '#DEB887', // Burlywood
      '#98FB98', // Pale Green
      '#DDA0DD', // Plum
      '#F08080', // Light Coral
      '#F4A460', // Sandy Brown
      '#9370DB'  // Medium Purple
    ],
    backgroundColor: 'transparent',
    textStyle: {
      color: '#F5E6D3',
      fontWeight: '500'
    },
    grid: {
      backgroundColor: 'transparent',
      borderColor: '#5D4E37'
    }
  },

  // Theme 5: Professional Modern
  professionalLight: {
    name: "Professional Light",
    description: "Modern corporate palette for light backgrounds",
    color: [
      '#1f77b4', // Blue
      '#ff7f0e', // Orange
      '#2ca02c', // Green
      '#d62728', // Red
      '#9467bd', // Purple
      '#8c564b', // Brown
      '#e377c2', // Pink
      '#7f7f7f', // Gray
      '#bcbd22', // Olive
      '#17becf'  // Cyan
    ],
    backgroundColor: '#FFFFFF',
    textStyle: {
      color: '#333333',
      fontWeight: '500'
    },
    grid: {
      backgroundColor: 'transparent',
      borderColor: '#E5E5E5'
    }
  },

  professionalDark: {
    name: "Professional Dark",
    description: "Modern corporate palette for dark backgrounds",
    color: [
      '#5DADE2', // Light Blue
      '#F39C12', // Light Orange
      '#58D68D', // Light Green
      '#EC7063', // Light Red
      '#BB8FCE', // Light Purple
      '#D7DBDD', // Light Gray
      '#F1948A', // Light Pink
      '#AEB6BF', // Medium Gray
      '#F7DC6F', // Light Yellow
      '#85C1E9'  // Sky Blue
    ],
    backgroundColor: 'transparent',
    textStyle: {
      color: '#E0E0E0',
      fontWeight: '500'
    },
    grid: {
      backgroundColor: 'transparent',
      borderColor: '#404040'
    }
  }
} as const;

export type ChartThemeKey = keyof typeof chartThemes;

// Helper function to get theme names grouped by category
export const getThemeGroups = () => {
  return {
    "High Contrast": ["highContrastLight", "highContrastDark"] as ChartThemeKey[],
    "Universal (Colorblind Safe)": ["colorblindSafeLight", "colorblindSafeDark"] as ChartThemeKey[],
    "Ocean Depths": ["oceanDepthsLight", "oceanDepthsDark"] as ChartThemeKey[],
    "Natural Elements": ["earthTonesLight", "earthTonesDark"] as ChartThemeKey[],
    "Professional": ["professionalLight", "professionalDark"] as ChartThemeKey[]
  };
};

// Get theme by key
export const getTheme = (themeKey: ChartThemeKey): ChartTheme => {
  return chartThemes[themeKey];
};

// Get all theme keys
export const getThemeKeys = (): ChartThemeKey[] => {
  return Object.keys(chartThemes) as ChartThemeKey[];
};

// Auto-select theme variant based on current UI theme
export const getAutoThemeKey = (isDark: boolean, baseTheme: string = 'professional'): ChartThemeKey => {
  const suffix = isDark ? 'Dark' : 'Light';
  const themeKey = `${baseTheme}${suffix}` as ChartThemeKey;
  return chartThemes[themeKey] ? themeKey : (isDark ? 'professionalDark' : 'professionalLight');
};
