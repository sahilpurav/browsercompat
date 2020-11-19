import ClientCompatIssueList from '../src/ClientCompatIssueList';
import ClientInfo from '../src/ClientInfo';
import Issue, { IssueKind } from '../src/Issue';
import Version from '../src/Version';

const clientInfo: ClientInfo = new ClientInfo(
  'a',
  'a',
  Version.minVal,
  Version.maxVal
);
let issueList: ClientCompatIssueList;

function globalIssues(list: ClientCompatIssueList, name: string): Issue[] {
  const arr: Issue[] = [];
  list.getIssuesForGlobal(name, arr);
  return arr;
}

function propIssues(
  list: ClientCompatIssueList,
  type: string,
  name: string
): Issue[] {
  const arr: Issue[] = [];
  list.getIssuesForPropertyOrEvent(type, name, false, arr);
  return arr;
}

function eventIssues(
  list: ClientCompatIssueList,
  type: string,
  name: string
): Issue[] {
  const arr: Issue[] = [];
  list.getIssuesForPropertyOrEvent(type, name, true, arr);
  return arr;
}

beforeAll(() => {
  issueList = new ClientCompatIssueList();

  issueList.setIssuesForGlobal('A', [
    new Issue('A', clientInfo, IssueKind.NOT_SUPPORTED)
  ]);
  issueList.setIssuesForGlobal('B', [
    new Issue('B', clientInfo, IssueKind.NOTE, null, 'Note for B')
  ]);
  issueList.setIssuesForGlobal('C', [
    new Issue('C', clientInfo, IssueKind.IS_PARTIAL_IMPL, null, 'Note for C'),
    new Issue('C', clientInfo, IssueKind.NEEDS_PREFIX, 'c-prefix')
  ]);
  issueList.setIssuesForGlobal('D', []);

  issueList.setIssuesForPropertyOrEvent('A', 'x', false, [
    new Issue('A.x', clientInfo, IssueKind.NOT_SUPPORTED)
  ]);
  issueList.setIssuesForPropertyOrEvent('A', 'y', false, [
    new Issue('A.y', clientInfo, IssueKind.NOTE, null, 'Note for A.y')
  ]);
  issueList.setIssuesForPropertyOrEvent('A', 'y', true, [
    new Issue('A.y', clientInfo, IssueKind.NOTE, null, 'Note for event A.y')
  ]);
  issueList.setIssuesForPropertyOrEvent('C', 'p', false, [
    new Issue('C.p', clientInfo, IssueKind.NEEDS_FLAG),
    new Issue(
      'C.p',
      clientInfo,
      IssueKind.NEEDS_ALT_NAME,
      'P',
      'Note for C.p (1)'
    ),
    new Issue('C.p', clientInfo, IssueKind.NOTE, null, 'Note for C.p (2)')
  ]);
  issueList.setIssuesForPropertyOrEvent('D', 'p', false, [
    new Issue('D.p', clientInfo, IssueKind.NOTE, null, 'Note for D.p')
  ]);
  issueList.setIssuesForPropertyOrEvent('D', 'p', true, [
    new Issue('D.p', clientInfo, IssueKind.NOTE, null, 'Note for event D.p')
  ]);
  issueList.setIssuesForPropertyOrEvent('E', 'p', false, [
    new Issue('E.p', clientInfo, IssueKind.NOTE, null, 'Note for E.p')
  ]);
  issueList.setIssuesForPropertyOrEvent('E', 'q', true, [
    new Issue('E.q', clientInfo, IssueKind.NOTE, null, 'Note for event E.q')
  ]);
});

test('ClientCompatIssueList.getIssuesForGlobal', () => {
  expect(globalIssues(issueList, 'A')).toMatchObject([
    { featureName: 'A', kind: IssueKind.NOT_SUPPORTED }
  ]);
  expect(globalIssues(issueList, 'B')).toMatchObject([
    { featureName: 'B', kind: IssueKind.NOTE, note: 'Note for B' }
  ]);
  expect(globalIssues(issueList, 'C')).toMatchObject([
    { featureName: 'C', kind: IssueKind.IS_PARTIAL_IMPL, note: 'Note for C' },
    { featureName: 'C', kind: IssueKind.NEEDS_PREFIX, altOrPrefix: 'c-prefix' }
  ]);
  expect(globalIssues(issueList, 'D')).toEqual([]);
  expect(globalIssues(issueList, 'E')).toEqual([]);
  expect(globalIssues(issueList, 'F')).toEqual([]);
});

test('ClientCompatIssueList.getIssuesForPropertyOrEvent', () => {
  expect(propIssues(issueList, 'A', 'x')).toMatchObject([
    { featureName: 'A.x', kind: IssueKind.NOT_SUPPORTED }
  ]);
  expect(propIssues(issueList, 'A', 'y')).toMatchObject([
    { featureName: 'A.y', kind: IssueKind.NOTE, note: 'Note for A.y' }
  ]);
  expect(propIssues(issueList, 'A', 'p')).toEqual([]);
  expect(propIssues(issueList, 'B', 'x')).toEqual([]);
  expect(propIssues(issueList, 'B', 'y')).toEqual([]);
  expect(propIssues(issueList, 'B', 'p')).toEqual([]);
  expect(propIssues(issueList, 'C', 'x')).toEqual([]);
  expect(propIssues(issueList, 'C', 'y')).toEqual([]);
  expect(propIssues(issueList, 'C', 'p')).toMatchObject([
    { featureName: 'C.p', kind: IssueKind.NEEDS_FLAG },
    {
      featureName: 'C.p',
      kind: IssueKind.NEEDS_ALT_NAME,
      altOrPrefix: 'P',
      note: 'Note for C.p (1)'
    },
    { featureName: 'C.p', kind: IssueKind.NOTE, note: 'Note for C.p (2)' }
  ]);
  expect(propIssues(issueList, 'D', 'x')).toEqual([]);
  expect(propIssues(issueList, 'D', 'y')).toEqual([]);
  expect(propIssues(issueList, 'D', 'p')).toMatchObject([
    { featureName: 'D.p', kind: IssueKind.NOTE, note: 'Note for D.p' }
  ]);
  expect(propIssues(issueList, 'E', 'x')).toEqual([]);
  expect(propIssues(issueList, 'E', 'y')).toEqual([]);
  expect(propIssues(issueList, 'E', 'p')).toMatchObject([
    { featureName: 'E.p', kind: IssueKind.NOTE, note: 'Note for E.p' }
  ]);
  expect(propIssues(issueList, 'E', 'q')).toEqual([]);
  expect(propIssues(issueList, 'F', 'x')).toEqual([]);
  expect(propIssues(issueList, 'F', 'y')).toEqual([]);
  expect(propIssues(issueList, 'F', 'p')).toEqual([]);

  expect(eventIssues(issueList, 'A', 'x')).toEqual([]);
  expect(eventIssues(issueList, 'A', 'y')).toMatchObject([
    { featureName: 'A.y', kind: IssueKind.NOTE, note: 'Note for event A.y' }
  ]);
  expect(eventIssues(issueList, 'A', 'p')).toEqual([]);
  expect(eventIssues(issueList, 'B', 'x')).toEqual([]);
  expect(eventIssues(issueList, 'B', 'y')).toEqual([]);
  expect(eventIssues(issueList, 'B', 'p')).toEqual([]);
  expect(eventIssues(issueList, 'C', 'x')).toEqual([]);
  expect(eventIssues(issueList, 'C', 'y')).toEqual([]);
  expect(eventIssues(issueList, 'C', 'p')).toEqual([]);
  expect(eventIssues(issueList, 'D', 'x')).toEqual([]);
  expect(eventIssues(issueList, 'D', 'y')).toEqual([]);
  expect(eventIssues(issueList, 'D', 'p')).toMatchObject([
    { featureName: 'D.p', kind: IssueKind.NOTE, note: 'Note for event D.p' }
  ]);
  expect(eventIssues(issueList, 'E', 'x')).toEqual([]);
  expect(eventIssues(issueList, 'E', 'y')).toEqual([]);
  expect(eventIssues(issueList, 'E', 'p')).toEqual([]);
  expect(eventIssues(issueList, 'E', 'q')).toMatchObject([
    { featureName: 'E.q', kind: IssueKind.NOTE, note: 'Note for event E.q' }
  ]);
  expect(eventIssues(issueList, 'F', 'x')).toEqual([]);
  expect(eventIssues(issueList, 'F', 'y')).toEqual([]);
  expect(eventIssues(issueList, 'F', 'q')).toEqual([]);
});
