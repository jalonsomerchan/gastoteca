import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { allocateUnits } from '../src/domain/money.js'

const php = process.env.PHP_BINARY || 'php'
const api = process.env.GASTOTECA_API || '/Applications/MAMP/htdocs/OV2/api/gastoteca/mistergastos.php'
function run(args, input) {
  const result = spawnSync(php, args, { input, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 })
  if (result.error) throw result.error
  assert.equal(result.status, 0, result.stdout + result.stderr)
  return result.stdout
}
process.stdout.write(run(['tests/money-api.test.php', api]))

let seed = 726
const random = max => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed % max }
const cases = [
  [2, [1, 1, 1, 1]], [1, [5000, 5000, 0]], [9999999900, [9999999899, 1, 0]],
  [9999999900, [9999999900, 9999999899, 9999999898]],
]
for (let index = 0; index < 10000; index++) {
  const total = index % 2 ? 9999999900 - random(1000000) : random(1000000)
  cases.push([total, Array.from({ length: 2 + random(12) }, () => random(9999999900) + 1)])
}
const actual = JSON.parse(run(['-r', `
require $argv[1];
$cases = json_decode(stream_get_contents(STDIN), true);
$results = array();
foreach ($cases as $case) $results[] = GastotecaMoney::allocate($case[0], $case[1]);
echo json_encode($results);
`, join(dirname(api), 'GastotecaMoney.php')], JSON.stringify(cases)))
cases.forEach(([total, weights], index) => assert.deepEqual(actual[index], allocateUnits(total, weights), `PHP/JS allocation ${index}`))
console.log(`PHP and JavaScript agree on all ${cases.length} allocation cases.`)
