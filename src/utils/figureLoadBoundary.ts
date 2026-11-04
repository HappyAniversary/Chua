import React from 'react';

/** Kept inside the Canvas so an asset failure leaves the rest of the world usable. */
export class FigureLoadBoundary extends React.Component<{
  resetKey: string;
  fallback: React.ReactNode;
  children: React.ReactNode;
}, { failed: boolean; resetKey: string }> {
  state = { failed: false, resetKey: this.props.resetKey };
  static getDerivedStateFromError() { return { failed: true }; }
  static getDerivedStateFromProps(props: { resetKey: string }, state: { resetKey: string }) {
    return props.resetKey !== state.resetKey ? { failed: false, resetKey: props.resetKey } : null;
  }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}
