import { forwardRef, useEffect, useState } from "react"
import PageWrapper from "./PageWrapper"

const LazyPageWrapper = forwardRef(function LazyPageWrapper({ rootRef, forceRender = false, children, ...props }, ref) {
  const [shouldRender, setShouldRender] = useState(forceRender)

  useEffect(() => {
    if (forceRender) {
      setShouldRender(true)
      return
    }

    const target = ref?.current
    const root = rootRef?.current
    if (!target || typeof IntersectionObserver === "undefined") {
      setShouldRender(true)
      return
    }

    setShouldRender(false)
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShouldRender(true)
          observer.disconnect()
        }
      },
      { root, rootMargin: "1400px 0px", threshold: 0 }
    )
    observer.observe(target)
    return () => observer.disconnect()
  }, [forceRender, ref, rootRef])

  return (
    <PageWrapper {...props} ref={ref}>
      {shouldRender ? children : null}
    </PageWrapper>
  )
})

export default LazyPageWrapper
