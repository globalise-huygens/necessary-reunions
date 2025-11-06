/**
 * Map category colors for GazetteerMap
 * Generates color palette from PoolParty taxonomy
 */

import { placeTypeTaxonomy } from './poolparty-taxonomy';

const colorFamilies: Record<string, string> = {
  settlement: '#1F4741', // Primary teal
  village: '#0F3731', // Dark teal
  kampong: '#0F3731', // Dark teal
  town: '#2D6B63', // Medium teal
  city: '#3A857A', // Light teal
  capital: '#4A9B8E', // Blue-teal
  port: '#4A9B8E', // Blue-green
  'coastal-settlement': '#5AA69A', // Light blue-green

  fort: '#3D2617', // Brown
  temple: '#8B4513', // Saddle brown
  church: '#654321', // Dark brown
  palace: '#9B7653', // Tan
  'guard-post': '#5A3A25', // Dark tan

  river: '#4A9B8E', // Blue-green
  stream: '#6BB5AA', // Light blue-green
  sea: '#3A8579', // Dark blue-green
  ocean: '#2C6B61', // Deep blue-green
  lake: '#5AA69A', // Medium blue-green
  bay: '#73BFB3', // Light bay blue
  gulf: '#4A9B8E', // Blue-green
  strait: '#3A8579', // Blue-green
  canal: '#6BB5AA', // Light blue-green

  island: '#D2691E', // Chocolate orange
  'island-group': '#E67A33', // Light orange
  mountain: '#B8571A', // Dark orange
  hill: '#C66220', // Medium orange
  peninsula: '#D2691E', // Orange
  cape: '#B8A055', // Yellow-tan
  point: '#A79048', // Dark yellow-tan
  coast: '#C9B166', // Light yellow-tan
  reef: '#8B7355', // Sandy brown

  region: '#9B8045', // Warm yellow
  province: '#8A7240', // Dark yellow
  kingdom: '#B09550', // Light yellow
  empire: '#C9B166', // Light gold
  negorij: '#A68A4A', // Medium yellow
  district: '#9B8045', // Yellow-brown
  regency: '#B09550', // Gold

  plantation: '#8B7355', // Brown-tan
  garden: '#9B8045', // Yellow-green
};

export function generateCategoryColors(): Record<string, string> {
  const colors: Record<string, string> = {};

  Object.keys(placeTypeTaxonomy).forEach((key) => {
    if (colorFamilies[key]) {
      colors[key] = colorFamilies[key];
    }
  });

  colors.plaats = '#1F4741';
  colors.stad = '#2D6B63';
  colors.dorp = '#0F3731';
  colors.rivier = '#4A9B8E';
  colors.eiland = '#D2691E';
  colors.berg = '#B8571A';
  colors.kaap = '#B8A055';
  colors.baai = '#73BFB3';
  colors.zee = '#6BB5AA';
  colors.meer = '#3A8579';
  colors.kasteel = '#5A3A25';
  colors.unknown = '#5A5A5A';

  return colors;
}

export const categoryColors = generateCategoryColors();
export const defaultFallbackColor = '#1F4741';
