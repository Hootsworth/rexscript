goal "low confidence python" {
  security {
    lockdown true
  }

  use.instead as $out {
    import math
    def calc(x):
      pass
  }
}
