// @vitest-environment jsdom
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import App from './App';
import {simulate} from './simulation';
import {DEFAULT_SCENARIO_NAME,SCENARIO_STORAGE_KEY} from './scenarioState';
// @ts-ignore Node built-ins are available in Vitest's jsdom runtime.
import {readFileSync} from 'node:fs';

vi.mock('./Globe',()=>({default:()=> <div aria-label="Map"/>}));

let stored:Map<string,string>;
const makeStorage=()=>({
 getItem:(key:string)=>stored.get(key)??null,
 setItem:(key:string,value:string)=>stored.set(key,value),
 removeItem:(key:string)=>{stored.delete(key)},
 clear:()=>stored.clear(),
});

beforeEach(()=>{
 stored=new Map();
 vi.stubGlobal('localStorage',makeStorage());
 vi.stubGlobal('navigator',{...navigator,onLine:false,serviceWorker:{register:vi.fn().mockResolvedValue(undefined)}});
 vi.stubGlobal('fetch',vi.fn());
});
afterEach(()=>{cleanup();vi.unstubAllGlobals()});

function applyDemandScenario(){
 fireEvent.change(screen.getByLabelText('Ship delay days'),{target:{value:'30'}});
 fireEvent.click(screen.getByRole('button',{name:/DEMAND REDUCTION/}));
 fireEvent.change(screen.getByLabelText('Hypothetical demand reduction'),{target:{value:'15'}});
 fireEvent.click(screen.getByRole('button',{name:/APPLY TO SIMULATION/}));
}
function displayedRisk(){return document.querySelector('.risk-number strong')?.textContent?.replace(/\s/g,'')}
function displayedRunway(){return document.querySelector('.risk-stats strong')?.textContent?.replace(/\s+/g,' ').trim()}
function activeRecord(){return JSON.parse(stored.get(SCENARIO_STORAGE_KEY)||'null')}
// @ts-ignore process.cwd is provided by the Vitest Node runner.
const stylesheet=readFileSync(`${process.cwd()}/src/style.css`,'utf8');

describe('offline scenario persistence',()=>{
 it('applies delay 30 and 15% demand reduction, then restores the canonical scenario and derived results after remount',()=>{
  const expected=simulate(30,{type:'demand',amount:15});
  expect(expected.probability).toBe(0);expect(expected.runway).toBeCloseTo(114,0);
  const view=render(<App/>);applyDemandScenario();
  expect(displayedRisk()).toBe('0.0%');expect(displayedRunway()).toBe('114 days');
  const record=activeRecord();
  expect(record.current).toMatchObject({stationId:'maitri',delayDays:30,scenarioName:DEFAULT_SCENARIO_NAME,action:{type:'demand',amount:15}});
  expect(record.selectedAction).toEqual({type:'demand',amount:15});
  // Even if a different hypothetical is previewed, a reload follows the active scenario.
  fireEvent.click(screen.getByRole('button',{name:/EMERGENCY AIRLIFT/}));
  expect(activeRecord().selectedAction.type).toBe('airlift');
  view.unmount();render(<App/>);
  expect((screen.getByLabelText('Ship delay days') as HTMLInputElement).value).toBe('30');
  expect(screen.getByRole('button',{name:/DEMAND REDUCTION/}).className).toContain('selected');
  expect((screen.getByLabelText('Hypothetical demand reduction') as HTMLInputElement).value).toBe('15');
  expect(displayedRisk()).toBe('0.0%');expect(displayedRunway()).toBe('114 days');
  expect(vi.mocked(fetch)).not.toHaveBeenCalled();
 },15000);

 it('restores Emergency Airlift and its active fuel quantity from the canonical scenario',()=>{
  const view=render(<App/>);
  fireEvent.click(screen.getByRole('button',{name:/EMERGENCY AIRLIFT/}));
  fireEvent.change(screen.getByLabelText('Hypothetical airlift fuel quantity'),{target:{value:'7000'}});
  fireEvent.click(screen.getByRole('button',{name:/APPLY TO SIMULATION/}));
  expect(activeRecord().current.action).toEqual({type:'airlift',amount:7000});
  expect(activeRecord().selectedAction).toEqual({type:'airlift',amount:7000});
  view.unmount();render(<App/>);
  expect(screen.getByRole('button',{name:/EMERGENCY AIRLIFT/}).className).toContain('selected');
  expect((screen.getByLabelText('Hypothetical airlift fuel quantity') as HTMLInputElement).value).toBe('7000');
  expect(document.querySelector('.action-result p')?.textContent).toMatch(/\+7,000 L airlift/);
  expect(displayedRisk()).toBe(`${(simulate(0,{type:'airlift',amount:7000}).probability*100).toFixed(1)}%`);
  expect(displayedRunway()).toBe(`${simulate(0,{type:'airlift',amount:7000}).runway.toFixed(0)} days`);
 },15000);

 it('persists Offline Demo through remount and does not contact the backend when the browser reconnects',()=>{
  vi.stubGlobal('navigator',{onLine:true,serviceWorker:{register:vi.fn().mockResolvedValue(undefined)}});
  const view=render(<App/>);
  fireEvent.click(screen.getByRole('button',{name:/LOCAL · ONLINE/}));
  expect(screen.getByRole('button',{name:/OFFLINE DEMO/})).toBeTruthy();
  expect(activeRecord().executionMode).toBe('offline-demo');
  window.dispatchEvent(new Event('online'));
  expect(vi.mocked(fetch)).not.toHaveBeenCalled();
  vi.mocked(navigator.serviceWorker.register).mockClear();
  view.unmount();render(<App/>);
  expect(screen.getByRole('button',{name:/OFFLINE DEMO/})).toBeTruthy();
  expect(navigator.serviceWorker.register).not.toHaveBeenCalled();
  window.dispatchEvent(new Event('online'));
  expect(vi.mocked(fetch)).not.toHaveBeenCalled();
 },15000);

 it('Undo restores and persists the previous scenario so reload cannot resurrect the applied action',()=>{
  const view=render(<App/>);applyDemandScenario();fireEvent.click(screen.getByRole('button',{name:/UNDO ACTION/}));
  expect(activeRecord().current).toMatchObject({delayDays:30,action:null});expect(activeRecord().previous).toBeNull();
  expect(displayedRisk()).toBe(`${(simulate(30).probability*100).toFixed(1)}%`);
  view.unmount();render(<App/>);
  expect((screen.getByLabelText('Ship delay days') as HTMLInputElement).value).toBe('30');
  expect(displayedRisk()).toBe(`${(simulate(30).probability*100).toFixed(1)}%`);
  expect(activeRecord().current.action).toBeNull();
 },15000);

 it('Reset persists baseline state and clears previous actions across reload',()=>{
  const view=render(<App/>);applyDemandScenario();fireEvent.click(screen.getByRole('button',{name:/RESET SCENARIO/}));
  expect(activeRecord()).toMatchObject({current:{stationId:'maitri',delayDays:0,scenarioName:DEFAULT_SCENARIO_NAME,action:null},previous:null});
  view.unmount();render(<App/>);
  expect((screen.getByLabelText('Ship delay days') as HTMLInputElement).value).toBe('0');
  expect(displayedRisk()).toBe(`${(simulate(0).probability*100).toFixed(1)}%`);
  expect(activeRecord().current.action).toBeNull();expect(activeRecord().previous).toBeNull();
 },15000);

 it('ignores malformed or outdated canonical storage without reviving stale legacy action keys',()=>{
  for(const invalid of ['{bad json','{"version":99,"current":{},"previous":null}']){
   stored=new Map([[SCENARIO_STORAGE_KEY,invalid],['setu-delay','30'],['setu-applied','{"type":"demand","amount":15}']]);
   vi.stubGlobal('localStorage',makeStorage());
   render(<App/>);
   expect((screen.getByLabelText('Ship delay days') as HTMLInputElement).value).toBe('0');
   expect(displayedRisk()).toBe(`${(simulate(0).probability*100).toFixed(1)}%`);
   cleanup();
  }
 });

 it('migrates a valid legacy local scenario when no canonical record exists',()=>{
  stored=new Map([['setu-delay','30'],['setu-applied','{"type":"demand","amount":15}'],['setu-scenario',DEFAULT_SCENARIO_NAME]]);
  vi.stubGlobal('localStorage',makeStorage());render(<App/>);
  expect(activeRecord().current).toMatchObject({delayDays:30,action:{type:'demand',amount:15}});
  expect(displayedRisk()).toBe('0.0%');expect(vi.mocked(fetch)).not.toHaveBeenCalled();
 });
});

describe('dashboard layout regression',()=>{
 it('exposes Apply Action and keeps Scenario Status after the full Decision Support panel',()=>{
  render(<App/>);
  const apply=screen.getByRole('button',{name:/APPLY TO SIMULATION/});
  const actionPanel=screen.getByRole('heading',{name:'Test a corrective action'}).closest('section')!;
  const statusPanel=screen.getByText('SCENARIO STATUS').closest('section')!;
  expect(apply).toBeTruthy();expect(actionPanel.contains(apply)).toBe(true);
  expect(Boolean(actionPanel.compareDocumentPosition(statusPanel)&Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);
  expect(screen.getByRole('button',{name:/EMERGENCY AIRLIFT/})).toBeTruthy();
  expect(screen.getByLabelText('Hypothetical airlift fuel quantity')).toBeTruthy();
 });

 it.each([[1440,900],[1365,768],[1280,600]])('keeps action controls reachable at %ix%ipx desktop viewport', (width,height)=>{
  Object.defineProperty(window,'innerWidth',{configurable:true,value:width});
  Object.defineProperty(window,'innerHeight',{configurable:true,value:height});
  render(<App/>);
  expect(screen.getByRole('button',{name:/APPLY TO SIMULATION/})).toBeTruthy();
  expect(screen.getByText('SCENARIO STATUS')).toBeTruthy();
  expect(screen.getByLabelText('Ship delay days')).toBeTruthy();
 });

 it('uses a vertically flowing page and content-sized dashboard rows instead of a clipped fixed action row',()=>{
  expect(stylesheet).toContain('body{min-height:100vh;overflow-y:auto}');
  expect(stylesheet).toContain('.dashboard-grid{grid-template-rows:minmax(370px,auto) auto');
  expect(stylesheet).toContain('.action-panel{height:max-content;min-height:300px;overflow:visible');
  expect(stylesheet).toContain('.bottom-grid{align-items:start}');
  expect(stylesheet).toContain('@media(max-height:760px) and (min-width:781px)');
 });
});
