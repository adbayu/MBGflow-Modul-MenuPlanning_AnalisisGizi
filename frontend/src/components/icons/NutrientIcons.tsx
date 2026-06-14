import React from "react";
import airIcon from "../../assets/svg/Air.svg";
import antioksidanIcon from "../../assets/svg/Antioksidan.svg";
import fitonutrienIcon from "../../assets/svg/Fitonutrien.svg";
import fosforIcon from "../../assets/svg/Fosfor.svg";
import gulaIcon from "../../assets/svg/Gula.svg";
import kaliumIcon from "../../assets/svg/Kalium.svg";
import kaloriIcon from "../../assets/svg/Kalori.svg";
import kalsiumIcon from "../../assets/svg/Kalsium.svg";
import karbohidratIcon from "../../assets/svg/Karbohidrat.svg";
import kolestrolIcon from "../../assets/svg/Kolestrol.svg";
import lemakIcon from "../../assets/svg/Lemak.svg";
import lemakJenuhIcon from "../../assets/svg/Lemak_Jenuh.svg";
import lemakTakJenuhIcon from "../../assets/svg/Lemak_Tak_Jenuh.svg";
import lodiumIcon from "../../assets/svg/Lodium.svg";
import magnesiumIcon from "../../assets/svg/Magnesium.svg";
import natriumIcon from "../../assets/svg/Natrium.svg";
import omega3Icon from "../../assets/svg/Omega_3.svg";
import omega6Icon from "../../assets/svg/Omega_6.svg";
import omega9Icon from "../../assets/svg/Omega_9.svg";
import probiotikIcon from "../../assets/svg/Probiotik.svg";
import proteinIcon from "../../assets/svg/Protein.svg";
import seratIcon from "../../assets/svg/Serat.svg";
import vitaminAIcon from "../../assets/svg/Vitamin_A.svg";
import vitaminB1Icon from "../../assets/svg/Vitamin_B1.svg";
import vitaminB2Icon from "../../assets/svg/Vitamin_B2.svg";
import vitaminB3Icon from "../../assets/svg/Vitamin_B3.svg";
import vitaminCIcon from "../../assets/svg/Vitamin_C.svg";
import vitaminDIcon from "../../assets/svg/Vitamin_D.svg";
import vitaminEIcon from "../../assets/svg/Vitamin_E.svg";
import vitaminKIcon from "../../assets/svg/Vitamin_K.svg";
import zatBesiIcon from "../../assets/svg/Zat_Besi.svg";
import zincIcon from "../../assets/svg/Zinc.svg";

type IconProps = React.ImgHTMLAttributes<HTMLImageElement> & {
  className?: string;
};

const nutrientIconMap: Record<string, string> = {
  air: airIcon,
  antioksidan: antioksidanIcon,
  fitonutrien: fitonutrienIcon,
  fosfor: fosforIcon,
  gula: gulaIcon,
  sugar: gulaIcon,
  kalium: kaliumIcon,
  kalori: kaloriIcon,
  energi: kaloriIcon,
  calorie: kaloriIcon,
  calories: kaloriIcon,
  kalsium: kalsiumIcon,
  karbo: karbohidratIcon,
  karbohidrat: karbohidratIcon,
  carb: karbohidratIcon,
  carbs: karbohidratIcon,
  carbohydrate: karbohidratIcon,
  carbohydrates: karbohidratIcon,
  kolestrol: kolestrolIcon,
  kolesterol: kolestrolIcon,
  lemak: lemakIcon,
  fat: lemakIcon,
  "lemak jenuh": lemakJenuhIcon,
  "lemak tak jenuh": lemakTakJenuhIcon,
  lodium: lodiumIcon,
  iodium: lodiumIcon,
  magnesium: magnesiumIcon,
  natrium: natriumIcon,
  omega3: omega3Icon,
  "omega 3": omega3Icon,
  omega6: omega6Icon,
  "omega 6": omega6Icon,
  omega9: omega9Icon,
  "omega 9": omega9Icon,
  probiotik: probiotikIcon,
  protein: proteinIcon,
  serat: seratIcon,
  fiber: seratIcon,
  vitamina: vitaminAIcon,
  "vitamin a": vitaminAIcon,
  vitaminb1: vitaminB1Icon,
  "vitamin b1": vitaminB1Icon,
  vitaminb2: vitaminB2Icon,
  "vitamin b2": vitaminB2Icon,
  vitaminb3: vitaminB3Icon,
  "vitamin b3": vitaminB3Icon,
  vitaminc: vitaminCIcon,
  "vitamin c": vitaminCIcon,
  vitamind: vitaminDIcon,
  "vitamin d": vitaminDIcon,
  vitamine: vitaminEIcon,
  "vitamin e": vitaminEIcon,
  vitamink: vitaminKIcon,
  "vitamin k": vitaminKIcon,
  "zat besi": zatBesiIcon,
  besi: zatBesiIcon,
  folat: fitonutrienIcon,
  folate: fitonutrienIcon,
  zinc: zincIcon,
  seng: zincIcon,
};

function normalizeIconKey(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
}

export function NutrientAssetIcon({
  name,
  className = "h-4 w-4",
  alt,
  ...props
}: IconProps & { name: string }) {
  const key = normalizeIconKey(name);
  const compactKey = key.replace(/\s+/g, "");
  const src = nutrientIconMap[key] || nutrientIconMap[compactKey] || kaloriIcon;

  return (
    <img
      src={src}
      alt={alt || name}
      className={`inline-block object-contain ${className}`}
      loading="lazy"
      style={{
        imageRendering: '-webkit-optimize-contrast',
        backfaceVisibility: 'hidden',
        transform: 'translateZ(0)'
      }}
      {...props}
    />
  );
}

export function CalorieIcon(props: IconProps) {
  return <NutrientAssetIcon name="kalori" {...props} />;
}

export function ProteinIcon(props: IconProps) {
  return <NutrientAssetIcon name="protein" {...props} />;
}

export function FatIcon(props: IconProps) {
  return <NutrientAssetIcon name="lemak" {...props} />;
}

export function CarboIcon(props: IconProps) {
  return <NutrientAssetIcon name="karbohidrat" {...props} />;
}

export default {
  CalorieIcon,
  ProteinIcon,
  FatIcon,
  CarboIcon,
  NutrientAssetIcon,
};
