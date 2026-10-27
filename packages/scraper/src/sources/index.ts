import type { Source } from "../source";
import { aftonbladet } from "./aftonbladet";
import { filmbladet } from "./filmbladet";
import { filmparadiset } from "./filmparadiset";
import { filmtopp } from "./filmtopp";
import { gamereactor } from "./gamereactor";
import { moviezine } from "./moviezine";
import { svd } from "./svd";
import { svt } from "./svt";

export const sources: Source[] = [
  aftonbladet,
  filmbladet,
  filmparadiset,
  filmtopp,
  gamereactor,
  moviezine,
  svd,
  svt,
];
