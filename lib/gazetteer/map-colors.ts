/**
 * Map category colors for GazetteerMap
 * Generates color palette from PoolParty taxonomy
 */

import { placeTypeTaxonomy } from './poolparty-taxonomy';

const colorFamilies: Record<string, string> = {
  settlement: '#1F4741',
  village: '#0F3731',
  kampong: '#0F3731',
  town: '#2D6B63',
  city: '#3A857A',
  capital: '#4A9B8E',
  port: '#4A9B8E',
  'coastal-settlement': '#5AA69A',

  fort: '#3D2617',
  temple: '#8B4513',
  church: '#654321',
  palace: '#9B7653',
  'guard-post': '#5A3A25',

  river: '#4A9B8E',
  stream: '#6BB5AA',
  sea: '#3A8579',
  ocean: '#2C6B61',
  lake: '#5AA69A',
  bay: '#73BFB3',
  gulf: '#4A9B8E',
  strait: '#3A8579',
  canal: '#6BB5AA',

  island: '#D2691E',
  'island-group': '#E67A33',
  mountain: '#B8571A',
  hill: '#C66220',
  peninsula: '#D2691E',
  cape: '#B8A055',
  point: '#A79048',
  coast: '#C9B166',
  reef: '#8B7355',

  region: '#9B8045',
  province: '#8A7240',
  kingdom: '#B09550',
  empire: '#C9B166',
  negorij: '#A68A4A',
  district: '#9B8045',
  regency: '#B09550',

  plantation: '#8B7355',
  garden: '#9B8045',
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
