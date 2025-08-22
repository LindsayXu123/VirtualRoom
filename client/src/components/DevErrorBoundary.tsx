// src/DevErrorBoundary.tsx
import React from 'react';
type S = { error: Error | null };
export default class DevErrorBoundary extends React.Component<React.PropsWithChildren, S> {
  state: S = { error: null };
  static getDerivedStateFromError(error: Error): S { return { error }; }
  componentDidCatch(error: Error, info: any) { console.error('UI error:', error, info); }
  render() { return this.state.error ? <div style={{padding:16,background:'#fff5f5',color:'#c92a2a'}}>{String(this.state.error)}</div> : this.props.children; }
}
