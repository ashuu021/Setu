// @vitest-environment jsdom
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import App from './App';

vi.mock('./Globe',()=>({default:()=> <div aria-label="Map"/>}));
beforeEach(()=>{const storage=new Map<string,string>();vi.stubGlobal('localStorage',{getItem:(key:string)=>storage.get(key)??null,setItem:(key:string,value:string)=>storage.set(key,value),removeItem:(key:string)=>storage.delete(key),clear:()=>storage.clear()});vi.stubGlobal('navigator',{...navigator,onLine:true,serviceWorker:{register:vi.fn().mockResolvedValue(undefined)}})});
afterEach(()=>{cleanup();vi.unstubAllGlobals()});

describe('Mission Control scenario controls',()=>{
 it('updates projected arrival when the delay slider moves',()=>{
  render(<App/>);fireEvent.change(screen.getByLabelText('Ship delay days'),{target:{value:'30'}});
  expect(screen.getByText('+30 DAYS FROM PLAN')).toBeTruthy();
 });
 it('reset restores the baseline delay',()=>{
  render(<App/>);fireEvent.change(screen.getByLabelText('Ship delay days'),{target:{value:'20'}});fireEvent.click(screen.getByText('RESET SCENARIO'));
  expect(screen.getByText('ON SCHEDULE')).toBeTruthy();
 });
 it('applies an action and records its simulation-only status',()=>{
  render(<App/>);fireEvent.click(screen.getByText(/APPLY TO SIMULATION/));
  expect(screen.getByText(/Hypothetical action active/)).toBeTruthy();
  expect(screen.getByText(/real-world authorization and execution are not performed/)).toBeTruthy();
  fireEvent.click(screen.getByText('Activity Log'));expect(screen.getByText(/Hypothetical airlift of 10,000 L/)).toBeTruthy();
 });
 it('keeps local controls available in demo offline mode',()=>{
  render(<App/>);fireEvent.click(screen.getByText('LOCAL · ONLINE'));fireEvent.change(screen.getByLabelText('Ship delay days'),{target:{value:'7'}});
  expect(screen.getByText('OFFLINE DEMO')).toBeTruthy();expect(screen.getByText('+7 DAYS FROM PLAN')).toBeTruthy();
 });
});
