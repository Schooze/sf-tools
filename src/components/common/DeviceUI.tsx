import {twMerge} from 'tailwind-merge';
import React from 'react';
export const button='px-3 py-2 rounded-lg border border-border bg-surface hover:bg-surface-hover text-xs text-sf-text disabled:opacity-40 disabled:cursor-not-allowed transition-colors';
export const primary=twMerge(button,'bg-blue-600 hover:bg-blue-500 border-blue-500 text-white');
export const input='w-full px-3 py-2 rounded-lg bg-background border border-border text-xs text-white font-mono focus:outline-none focus:border-blue-500 disabled:opacity-40';
export function Page({title,description,children,actions}:{title:string;description:string;children:React.ReactNode;actions?:React.ReactNode}){
 return <div className="h-full overflow-y-auto p-6 space-y-5 max-w-6xl mx-auto text-xs"><header className="flex items-center justify-between gap-3"><div><h1 className="text-base font-semibold text-white">{title}</h1><p className="text-sf-muted mt-1 leading-relaxed">{description}</p></div>{actions}</header>{children}</div>;
}
export function Card({title,children}:{title:string;children:React.ReactNode}){
 return <section className="p-5 rounded-2xl bg-surface/60 border border-border space-y-4"><h2 className="font-semibold text-white">{title}</h2>{children}</section>;
}
export function NumberField({label,value,onChange,unit='',error,disabled=false,note}:{label:string;value:number;onChange:(value:number)=>void;unit?:string;error?:string;disabled?:boolean;note?:string}){
 return <label className="block space-y-1.5"><span className="text-sf-muted">{label}{unit?' · '+unit:''}</span><input aria-label={label} className={input+(error?' border-red-500':'')} type="number" step="any" value={Number.isFinite(value)?value:''} disabled={disabled} onChange={e=>onChange(e.target.value===''?NaN:Number(e.target.value))}/>{error&&<span className="text-red-400 block">{error}</span>}{note&&<span className="text-sf-subtle leading-relaxed block">{note}</span>}</label>;
}
