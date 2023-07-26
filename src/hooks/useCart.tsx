import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { toast } from "react-toastify";
import { api } from "../services/api";
import { Product, Stock } from "../types";

interface CartProviderProps {
  children: ReactNode;
}

interface UpdateProductAmount {
  productId: number;
  amount: number;
  action: "add" | "remove";
}

interface CartContextData {
  cart: Product[];
  addProduct: (productId: number) => Promise<void>;
  removeProduct: (productId: number) => void;
  updateProductAmount: ({
    productId,
    amount,
    action,
  }: UpdateProductAmount) => void;
  verifyQtdInStock: (productId: number) => Promise<number>;
}

const CartContext = createContext<CartContextData>({} as CartContextData);

export function CartProvider({ children }: CartProviderProps): JSX.Element {
  const [cart, setCart] = useState<Product[]>(() => {
    const storagedCart = localStorage.getItem("@RocketShoes:cart");

    if (storagedCart) {
      return JSON.parse(storagedCart);
    }

    return [];
  });

  const prevCartRef = useRef<Product[]>();

  const updateStockAmount = async (
    productId: number,
    qtdStock: number,
    action: "add" | "remove"
  ) => {
    try {
      const amount = action == "add" ? qtdStock - 1 : qtdStock + 1;

      await api.patch(`/stock/${productId}`, {
        id: productId,
        amount,
      });
    } catch (e) {
      console.log(`error update stock ${e}`);
    }
  };

  const verifyQtdInStock = async (productId: number) => {
    try {
      const { data } = await api.get(`/stock/${productId}`);

      return data?.amount;
    } catch (e) {
      console.log(`error stock of productId ${productId}: ${e}`);
    }
  };

  const addProduct = async (productId: number) => {
    try {
      const productInCart = cart.find((product) => product.id == productId);
      if (!productInCart) {
        const amountStock = await verifyQtdInStock(productId);

        if (!amountStock) {
          toast.error("Quantidade solicitada fora de estoque");
          return;
        }

        const { data } = await api.get(`/products/${productId}`);
        setCart([...cart, { ...data, amount: 1 }]);

        updateStockAmount(productId, amountStock, "add");
        return;
      }

      updateProductAmount({
        productId,
        amount: productInCart.amount + 1,
        action: "add",
      });
    } catch (e) {
      console.log(`error addProduct: ${e}`);
      toast.error("Erro na adição do produto");
    }
  };

  const removeProduct = async (productId: number) => {
    try {
      const amount = await verifyQtdInStock(productId);
      const productRemove = cart.find((product) => product.id == productId);

      if (productRemove) {
        setCart(cart.filter((product) => product.id != productId));
        updateStockAmount(productId, amount, "remove");
      }
    } catch {
      toast.error("Erro na remoção do produto");
    }
  };

  const updateProductAmount = async ({
    productId,
    amount,
    action,
  }: UpdateProductAmount) => {
    try {
      const amountStock = await verifyQtdInStock(productId);
      console.log(
        "🚀 ~ file: useCart.tsx:108 ~ CartProvider ~ amountStock:",
        amountStock
      );

      if (amount > amountStock)
        return toast.error("Quantidade solicitada fora de estoque");

      const getProduct = cart.find((product) => product.id == productId);

      if (getProduct) {
        const getProductIndex = cart.findIndex(
          (product) => product.id == productId
        );

        const newCart = [...cart];
        newCart[getProductIndex] = { ...getProduct, amount };

        setCart(newCart);

        action == "add"
          ? updateStockAmount(productId, amountStock, "add")
          : updateStockAmount(productId, amountStock, "remove");
      }
    } catch (e) {
      console.log(`error addProduct: ${e}`);
      toast.error("Erro na atualização da quantidade do produto");
    }
  };

  useEffect(() => {
    prevCartRef.current = cart;
  });

  const prevCart = prevCartRef.current ?? cart;

  useEffect(() => {
    if (prevCart !== cart) {
      localStorage.setItem("@RocketShoes:cart", JSON.stringify(cart));
    }
  }, [cart, prevCart]);

  return (
    <CartContext.Provider
      value={{
        cart,
        addProduct,
        removeProduct,
        updateProductAmount,
        verifyQtdInStock,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart(): CartContextData {
  const context = useContext(CartContext);

  return context;
}
