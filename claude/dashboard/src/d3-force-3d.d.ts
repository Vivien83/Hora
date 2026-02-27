declare module "d3-force-3d" {
  export function forceRadial(
    radius: number,
    x?: number,
    y?: number,
  ): { strength(s: number | ((node: any) => number)): any };

  export function forceCenter(
    x?: number,
    y?: number,
  ): { strength(s: number): any };
}
