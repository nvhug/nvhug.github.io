export type GovernanceDisclosure = {
  title: string
  url: string
  publishedAt: string | null
}

export type GovernanceDisclosures = {
  source: 'Vietstock'
  documents: GovernanceDisclosure[]
}

type VietstockDocument = {
  Title?: string
  FullName?: string
  Url?: string
  LastUpdate?: string
}

const PAGE_ORIGIN = 'https://finance.vietstock.vn'
const GOVERNANCE_DOCUMENT = /báo cáo (tình hình )?quản trị|quản trị công ty|hội đồng quản trị|hđqt|đhđcđ|đại hội đồng cổ đông|báo cáo thường niên/i

function dateFromVietstock(value?: string): string | null {
  const timestamp = /\/Date\((\d+)\)\//.exec(value ?? '')?.[1]
  return timestamp ? new Date(Number(timestamp)).toISOString() : null
}

export function governanceDisclosuresFromVietstock(records: VietstockDocument[]): GovernanceDisclosures | null {
  const documents = records
    .filter((record): record is VietstockDocument & { Url: string } => Boolean(record.Url) && GOVERNANCE_DOCUMENT.test(record.Title ?? record.FullName ?? ''))
    .slice(0, 6)
    .map((record) => ({
      title: record.Title ?? record.FullName ?? 'Tài liệu công bố',
      url: record.Url,
      publishedAt: dateFromVietstock(record.LastUpdate),
    }))

  return documents.length > 0 ? { source: 'Vietstock', documents } : null
}

export async function fetchGovernanceDisclosures(ticker: string): Promise<GovernanceDisclosures | null> {
  try {
    const pageUrl = `${PAGE_ORIGIN}/${encodeURIComponent(ticker)}-ho-so-doanh-nghiep.htm`
    const page = await fetch(pageUrl, {
      headers: { Accept: 'text/html', 'User-Agent': 'Mozilla/5.0' },
      next: { revalidate: 86_400 },
      signal: AbortSignal.timeout(10_000),
    })
    if (!page.ok) return null

    const html = await page.text()
    const token = /<form action=\/[A-Z0-9-]+\.htm id=__CHART_AjaxAntiForgeryForm[^>]*>\s*<input[^>]*value=([^\s>]+)/i.exec(html)?.[1]
    if (!token) return null

    const cookie = page.headers.get('set-cookie')?.split(';')[0]
    const response = await fetch(`${PAGE_ORIGIN}/data/GetDocument`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        Referer: pageUrl,
        'User-Agent': 'Mozilla/5.0',
        'X-Requested-With': 'XMLHttpRequest',
        ...(cookie ? { Cookie: cookie } : {}),
      },
      body: new URLSearchParams({ code: ticker, page: '1', pageSize: '100', __RequestVerificationToken: token }),
      signal: AbortSignal.timeout(10_000),
    })
    if (!response.ok) return null
    if (!(response.headers.get('content-type') ?? '').includes('application/json')) return null

    return governanceDisclosuresFromVietstock(await response.json() as VietstockDocument[])
  } catch (error) {
    console.warn('[stock-analysis] governance disclosure lookup failed:', error)
    return null
  }
}